'use strict';

const { sanitizeEntity } = require('strapi-utils');
const stripe = require("stripe")(process.env.STRIPE_SK);

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
    async find(ctx) {
        const { user } = ctx.state;
    
        let entities;
        if (ctx.query._q) {
          entities = await strapi.services.order.search({...ctx.query, user: user.id});
        } else {
          entities = await strapi.services.order.find({...ctx.query, user: user.id});
        }
    
        return entities.map(entity => sanitizeEntity(entity, { model: strapi.models.order }));
      },

    async findOne(ctx) {
        const { id } = ctx.params;
        const { user } = ctx.state;

        const entity = await strapi.services.order.findOne({ id, user: user.id })
        return sanitizeEntity(entity, { model: strapi.models.order });
    },

    async create(ctx){
        const cart  = ctx.request.body;

        if(!cart){
            return ctx.throw(400, "please specify the cart")
        }
        
        const finalCart = await strapi.services.cart.findOne({ id: cart[0].id })
        if(!finalCart){
            return ctx.throw(404, "cart not found")
        }
        const { user } = ctx.state;
        const BASE_URL = ctx.request.headers.origin || "http://localhost:3000";

        const line_items = finalCart.items.map((item) => {
            const cartItem = {};
            cartItem.price_data = {
                currency: 'inr',
                product_data: {
                    name: item.products[0].title,
                },
                unit_amount: (item.products[0].price * 100).toFixed(0)
            }
            cartItem.quantity = 1;
            return cartItem;
        })

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            customer_email: user.email,
            mode: "payment",
            success_url: `${BASE_URL}/success/session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: BASE_URL,
            line_items
        })

        const orders_data = finalCart.items.map((item) => {
            const orderItem = {
                name: item.products[0].title,
                price: item.products[0].price
            };

            return orderItem
        })

        await strapi.services.order.create({
            user: user.id,
            cart: finalCart.id,
            total: finalCart.total_price,
            status: "unpaid",
            checkout_session: session.id,
            orders_data
        })
        return { id: session.id }
    },

    async confirm(ctx){
        const { session_id } = ctx.request.body;

        const session = await stripe.checkout.sessions.retrieve(session_id);

        if(session.payment_status === "paid"){
            const { cart } = ctx.state.user;

            const updateOrder = await strapi.services.order.update({
                checkout_session: session_id
            },
            {
                status: "paid"
            });

           
            await strapi.services.cart.delete({ id: cart.id })
            return sanitizeEntity(updateOrder, { model: strapi.models.order })
        } else{
            return ctx.throw(400, "The payment wasn't successful")
        }
    }
};

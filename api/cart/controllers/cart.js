'use strict';
const { sanitizeEntity } = require('strapi-utils');

module.exports = {

  async find(ctx) {

    const { user } = ctx.state;

    let entities;
    if (ctx.query._q) {
      entities = await strapi.services.cart.search({...ctx.query, user: user.id});
    } else {
      entities = await strapi.services.cart.find({...ctx.query, user: user.id});
    }

    return entities.map(entity => sanitizeEntity(entity, { model: strapi.models.cart }));
  },

  async create(ctx) {
      const cartItem = ctx.request.body;
      const { user } = ctx.state;
      const cart = {
        items: [{
          products: cartItem
        }],
        total_price: cartItem.price,
        user: user.id
      }
      const entity = await strapi.services.cart.create(cart);
      return sanitizeEntity(entity, { model: strapi.models.cart });
  },

  async delete(ctx) {
    const { id, itemId } = ctx.params;
    const { cart } = ctx.state.user;


    if(cart.items.length === 1){
      const entity = await strapi.services.cart.delete({id})
      return sanitizeEntity(entity, { model: strapi.models.cart });
    }

    const items = cart.items.filter( item => item.id != itemId );
    const item = cart.items.filter( item => item.id == itemId);
    const total_price = cart.total_price - item[0].products[0].price;
    
    const entity = await strapi.services.cart.update({ id }, {items, total_price} );
    return sanitizeEntity(entity, { model: strapi.models.cart });
  },

  async update(ctx) {
      const { id } = ctx.params;
      const { cart } = ctx.state.user;
      const item = ctx.request.body;
      

      const items = [...cart.items, item]
      const total_price = cart.total_price + item.products.price;

      const entity = await strapi.services.cart.update({ id }, {items, total_price} );
      return sanitizeEntity(entity, { model: strapi.models.cart })   
  }
};


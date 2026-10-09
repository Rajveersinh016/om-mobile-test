/**
 * OM Mobile Art — Shared Pricing Engine (pricing.js)
 * Single source of truth for all price calculations across the entire application:
 * Product Detail, Quick Add, Cart, Mini Cart, Checkout, Order Review, Confirmation, Admin Order View, Order History, Invoice, Payment Payload.
 */

(function() {
    'use strict';

    const PricingEngine = {
        /**
         * Standardizes a raw numerical price into target currency unit.
         * If currency is '₹': if price < 200, assumes USD and multiplies by 80. Otherwise keeps as INR.
         * @param {number} rawPrice 
         * @param {string} [curr] 
         * @returns {number}
         */
        /**
         * Standardizes a raw numerical price into canonical integer INR value without arbitrary multipliers.
         * @param {number|string} rawPrice 
         * @returns {number}
         */
        normalizePrice(rawPrice) {
            const num = Number(rawPrice);
            return isNaN(num) ? 0 : Math.round(num);
        },

        /**
         * Calculates final unit price for a product/cart item taking base price and option adjustments into account.
         * Formula: Base Price + Material Offset + Finish Offset + Option Offset
         * @param {Object} item - Product or cart item
         * @returns {number}
         */
        calculateItemUnitPrice(item) {
            if (!item) return 0;
            const basePrice = this.normalizePrice(item.price || item.basePrice || 0);

            const finishPrice = this.normalizePrice(item.finishPrice || item.finishOffset || (item.selectedFinish ? item.selectedFinish.priceOffset : 0));
            const materialPrice = this.normalizePrice(item.materialPrice || item.materialOffset || (item.selectedMaterial ? item.selectedMaterial.priceOffset : 0));
            const optionPrice = this.normalizePrice(item.optionPrice || item.optionOffset || 0);

            return basePrice + finishPrice + materialPrice + optionPrice;
        },

        /**
         * Master calculation function for cart / order totals.
         * Calculation Order:
         * Base Product Price + Material Adjustment + Finish Adjustment
         * = Product Final Price × Quantity = Item Subtotal
         * Sum of Item Subtotals = Subtotal
         * + Shipping (Free if Subtotal >= ₹999 or Subtotal === 0, else ₹99)
         * + GST (12% of Subtotal)
         * - Coupon Discount
         * = Grand Total
         * 
         * @param {Array} items - List of cart/order items
         * @param {Object|null} coupon - Applied coupon object if any
         * @returns {Object} Full breakdown of totals
         */
        calculateTotals(items = [], coupon = null) {
            const currency = (window.SettingsManager && window.SettingsManager.getCurrencySymbol) ? window.SettingsManager.getCurrencySymbol() : '₹';
            const freeThreshold = (window.SettingsManager && window.SettingsManager.getFreeShippingThreshold) ? window.SettingsManager.getFreeShippingThreshold() : 999;
            const flatShipping = (window.SettingsManager && window.SettingsManager.getFlatShippingRate) ? window.SettingsManager.getFlatShippingRate() : 49;

            let subtotal = 0;
            const itemBreakdown = (items || []).map(item => {
                const unitPrice = this.calculateItemUnitPrice(item);
                const qty = Math.max(1, Number(item.qty || item.quantity) || 1);
                const itemTotal = unitPrice * qty;
                subtotal += itemTotal;
                return {
                    ...item,
                    unitPrice,
                    qty,
                    itemTotal
                };
            });

            // Calculate Shipping: Free if Subtotal >= freeThreshold or Subtotal === 0, else flatShipping
            let shippingFee = 0;
            if (subtotal > 0 && subtotal < freeThreshold) {
                shippingFee = flatShipping;
            }

            // Tax is disabled (0 GST)
            const gstTax = 0;

            // Calculate Coupon Discount
            let discountAmount = 0;
            if (coupon && subtotal > 0) {
                if (coupon.calculatedDiscount !== undefined && coupon.calculatedDiscount !== null) {
                    discountAmount = Number(coupon.calculatedDiscount) || 0;
                } else {
                    const discType = String(coupon.discountType || coupon.type || '').toUpperCase();
                    if (discType === 'PERCENTAGE') {
                        discountAmount = Math.round(subtotal * ((Number(coupon.discountValue || coupon.value) || 0) / 100));
                    } else {
                        discountAmount = this.normalizePrice(coupon.discountValue || coupon.value || 0);
                    }
                }
                discountAmount = Math.min(discountAmount, subtotal);
            }

            // Grand Total = Subtotal - Discount + Shipping
            const grandTotal = Math.max(0, Math.round(subtotal - discountAmount + shippingFee));

            return {
                currency,
                items: itemBreakdown,
                subtotal,
                shippingFee,
                isFreeShipping: shippingFee === 0,
                tax: 0,
                discount: discountAmount,
                couponCode: coupon ? (coupon.code || coupon.couponCode || '') : null,
                grandTotal,
                totalPrice: grandTotal
            };
        },

        /**
         * Formats a raw number into currency string using SettingsManager.
         * @param {number} amount 
         * @returns {string}
         */
        format(amount) {
            const num = Number(amount) || 0;
            const sym = (window.SettingsManager && window.SettingsManager.getCurrencySymbol) ? window.SettingsManager.getCurrencySymbol() : '₹';
            return sym + Math.round(num).toLocaleString('en-IN');
        }
    };

    // Attach to global window
    window.PricingEngine = PricingEngine;
})();

/* Copyright (c) 2016-Present Webkul Software Pvt. Ltd. (<https://webkul.com/>) */
/* See LICENSE file for full copyright and licensing details. */
/* License URL : <https://store.webkul.com/license.html/> */
odoo.define('pos_paypal_payment_acquirer.payment_screen', function (require) {
    "use strict";

    var core = require('web.core');
    var _t = core._t;
    var ajax = require('web.ajax');
    var rpc = require('web.rpc');
    var QWeb = core.qweb;
    var src = window.location.pathname;
    var config_id = src.split('payment/') && src.split('payment/')[1][0];
    var current_transaction = null;
    var is_refresh = true;



    var screenRetrieve;

    function retrieve_screen_updates() {
        ajax.jsonRpc("/pos/payment/" + config_id + "/update/", 'call', {
                'template_screen_type': $('.main_body').attr('screen-type'),
                'is_refresh': is_refresh
            })
            .then(function (vals) {
                if (vals && ((vals.screen_data && vals.screen_data.length) || (vals.payment_data && vals.payment_data.length))) {
                    if (vals.type_of_screen == 'payment') {
                        var txn_data = JSON.parse(vals.payment_data[0].txn_data);
                        var temp = txn_data.qr_code;
                        temp = temp.split('json')[1].split('--')[0]
                        var qr_code_base64 = 'data:image/png;base64,' + temp.trim();
                        ajax.loadXML('/pos_paypal_payment_acquirer/static/src/xml/pos_paypal.xml', QWeb).then(function (res) {
                            var boyd_html = QWeb.render('PaypalPaymentTemplate', {
                                'company': vals.company,
                                'payment_amount': vals.payment_amount,
                                'customer_name': vals.customer_name,
                                'qr_code_base64': qr_code_base64,
                                'order_ref': vals.order_ref
                            });
                            $('.main_body').html(boyd_html);
                            is_refresh = false;
                            rpc.query({
                                'method': 'update_screen_info',
                                'model': 'pos.payment.screen.config',
                                'args': [parseInt(config_id)]
                            })
                            current_transaction = vals.payment_data[0].id;
                            $('.main_body').attr('screen-type', vals.type_of_screen)
                            $('body').unbind().on('click', '#cancel_payment', function (event) {
                                rpc.query({
                                    'method': 'update_payment_status',
                                    'model': 'pos.payment.transaction',
                                    'args': [false, 'CANCELLED', current_transaction, parseInt(config_id), false]
                                });
                            });
                            var customer_name = $('#customer-name').val();
                            var customer_data = {
                                'customer_name': customer_name
                            }
                            ajax.jsonRpc("/retrieve-invoice", 'call', {
                                    'data': txn_data
                                })
                                .then(function (source) {
                                    if (source.status === 'MARKED_AS_PAID' || source.status === 'PAID') {
                                        $('.col-md-7').append(`<div class="payment-successful">Thanks For The Payment!!</div>`)
                                    }
                                    if (source.status === 'CANCELLED') {
                                        $('.col-md-7').append(`<div class="payment-cancelled">Payment Has Not Completed!!</div>`)
                                    }
                                });
                        })
                    } else {
                        ajax.loadXML('/pos_paypal_payment_acquirer/static/src/xml/pos_paypal.xml', QWeb).then(function (res) {
                            var images = vals.images.map(function (res) {
                                return 'data:image/png;base64,' + res.image;
                            })
                            var boyd_html = QWeb.render('PosWelcomeScreenTemplate', {
                                'screen_data': vals.screen_data[0],
                                'images': images,
                                'pos_name': vals.pos_name,
                                'company': vals.company

                            });
                            $('.main_body').html(boyd_html);
                            is_refresh = false;
                            $('.main_body').attr('screen-type', vals.type_of_screen)
                            rpc.query({
                                'method': 'update_screen_info',
                                'model': 'pos.payment.screen.config',
                                'args': [parseInt(config_id)]
                            })
                        })
                    }
                }

            });

    }
    screenRetrieve = setInterval(retrieve_screen_updates, 2000);

});
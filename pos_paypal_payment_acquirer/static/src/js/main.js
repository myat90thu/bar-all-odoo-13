/* Copyright (c) 2016-Present Webkul Software Pvt. Ltd. (<https://webkul.com/>) */
/* See LICENSE file for full copyright and licensing details. */
/* License URL : <https://store.webkul.com/license.html/> */
odoo.define('pos_paypal_payment_acquirer.pos_paypal_payment_acquirer', function (require) {
    "use strict";

    var core = require('web.core');
    var _t = core._t;
    var ajax = require('web.ajax');
    var screens = require('point_of_sale.screens');
    var models = require('point_of_sale.models');
    var rpc = require('web.rpc');
    var DB = require('point_of_sale.DB');
    var PopUpWidget = require('point_of_sale.popups');
    var gui = require('point_of_sale.gui');
    var model_list = models.PosModel.prototype.models;
    var SuperPaymentline = models.Paymentline.prototype;
    var payment_method_model = null;


	models.load_models([{
		model: 'pos.payment.screen.config',
		label: 'Pos Paypal Payment Screen',
		fields: ['related_id','url','welcome_screen_content','welcome_screen_subheading','welcome_screen_heading'],
		loaded: function(self, result) {
		  self.db.pos_paypal_screen_data = null;
		  _.each(result, function(data) {
			  if(data && (data.related_id[0] == self.config.id))
			  	self.db.pos_paypal_screen_data = data;
		  });
		}
	  }],{'after':'pos.config'});

	models.load_models([{
		model: 'promotion.image',
		label: 'Promotional Images',
		fields: ['promotions_related_id','image'],
		loaded: function(self, result) {
		  self.db.paypal_screen_promotional_images = [];
		  _.each(result, function(data) {
			  if(data.promotions_related_id[0] == self.db.pos_paypal_screen_data.id)
			  	self.db.paypal_screen_promotional_images.push(data);
		  });
		}
	  }],{'after':'pos.screen.config'});


    models.load_fields('pos.payment.method', 'paypal_payment_method');

    //--Fetching model dictionary--
    for (var i = 0, len = model_list.length; i < len; i++) {
        if (model_list[i].model == "pos.payment.method") {
            payment_method_model = model_list[i];
            break;
        }
    }

    models.load_models([{
        model: 'pos_paypal.configuration',
        label: 'Paypal',
        fields: ['name','secret_key', 'publishable_key', 'active_record'],
        loaded: function (self, result) {
            _.each(result, function (res) {
                if (res.active_record) {
                    self.db.paypalApiKey = res;
                }
            });
        }
    }]);

    //--Searching wallet journal--
    var super_payment_method_loaded = payment_method_model.loaded;
    payment_method_model.loaded = function (self, payment_methods) {
        super_payment_method_loaded.call(this, self, payment_methods);
        payment_methods.forEach(function (payment_method) {
            if (payment_method.paypal_payment_method) {
                self.db.paypal_payment_method = payment_method;
                return true;
            }
        });
    };

    screens.ProductScreenWidget.include({

        start:function(){
            var self = this;
            self._super();
            console.log("paypal screen data",self.pos.db.pos_paypal_screen_data)
            if(self.pos.db.pos_paypal_screen_data){
                console.log("Start work")
                rpc.query({
                    'method':'update_screen_on_pos',
                    'model':'pos.payment.screen.config',
                    'args':[self.pos.db.pos_paypal_screen_data.id]
                })
            }
        }
    })


    var PaymentNotifyPopupWidget = PopUpWidget.extend({
        template: 'PaymentNotifyPopupWidget',
        events: {
            'click .button.cancel': 'click_cancel'
        },
        show: function (options) {
            var self = this;
            self._super(options);
            this.options = options;
            this.$('.order_status').show();
            $('#order_sent_status').hide();
            this.$('.order_status').removeClass('order_done');
            this.$('.show_tick').hide();
            setTimeout(function () {
                $('.order_status').addClass('order_done');
                $('.show_tick').show();
                $('#order_sent_status').show();
                $('.order_status').css({
                    'border-color': '#5cb85c'
                })
            }, 500)
            setTimeout(function () {
                self.click_cancel();
            }, 1500)
        },
    });
    gui.define_popup({
        name: 'payment_notify',
        widget: PaymentNotifyPopupWidget
    });



    var PaypalPaymentPopup = PopUpWidget.extend({
        template: 'PaypalPaymentPopup',
        show: function (options) {
            this._super(options);
        },

    });

    gui.define_popup({
        name: 'test_popup',
        widget: PaypalPaymentPopup
    });


    var _paylineproto = models.Paymentline.prototype;
    models.Paymentline = models.Paymentline.extend({
        initialize: function (attributes, options) {
            this.is_paypal_payment_line = false;
            this.is_paypal_payment_failed = false;
            this.is_paypal_payment_cancel = false;
            this.last_payment_source = null;
            this.paypal_payment_pending = false;
            this.src_id = '';
            SuperPaymentline.initialize.call(this, attributes, options);
        },
        init_from_JSON: function (json) {
            _paylineproto.init_from_JSON.apply(this, arguments);
            this.is_paypal_payment_line = json.is_paypal_payment_line;
            this.paypal_payment_pending = json.paypal_payment_pending;
            this.src_id = json.src_id;
        },
        export_as_JSON: function () {
            var self = this;
            var src_id = null;
            if(self.src_id)
                var src_id = self.src_id;
            return _.extend(_paylineproto.export_as_JSON.apply(this, arguments), {
                paid: this.paid,
                paypal_payment_pending: this.paypal_payment_pending,
                is_paypal_payment_line: this.is_paypal_payment_line,
                src_id:src_id,
            });
        },
    });

    var PaymentNotifyPopupWidget = PopUpWidget.extend({
        template: 'PaymentNotifyPopupWidget',
        events: {
            'click .button.cancel': 'click_cancel'
        },
        show: function (options) {
            var self = this;
            self._super(options);
            this.options = options;
            this.$('.order_status').show();
            $('#order_sent_status').hide();
            this.$('.order_status').removeClass('order_done');
            this.$('.show_tick').hide();
            setTimeout(function () {
                $('.order_status').addClass('order_done');
                $('.show_tick').show();
                $('#order_sent_status').show();
                $('.order_status').css({
                    'border-color': '#5cb85c'
                })
            }, 500)
            setTimeout(function () {
                self.click_cancel();
            }, 1500)
        },
    });
    gui.define_popup({
        name: 'payment_notify',
        widget: PaymentNotifyPopupWidget
    });


    var QRcodePopup = PopUpWidget.extend({
        template: 'QRcodePopup',
        show: function (options) {
            this._super();
            var self = this;
            self.options = options;
            var temp = options.vals.qr_code;
            temp = temp.split('json')[1].split('--')[0]
            var new_temp = 'data:image/png;base64,'+temp.trim();
            try {
                $('#paypal_qrcode').attr('src',new_temp)
            } catch (error) {
                console.error(error)
            }
            var src_id = options.vals.txn_id;
            self.paypal_retrieve_source(options.vals);
        },


        click_cancel: function () {
            this._super();
            this.pos.get_order().selected_paymentline.is_paypal_payment_failed = true;
            var interval = this.interval;
            clearInterval(interval);
            $('.paymentline.selected .refresh-button .fa-refresh').removeClass('fa-spin')

        },

        paypal_retrieve_source: function (data) {
            var self = this;
            var MAX_POLL_COUNT = 600;
            var pollCount = 0;
            var interval = setInterval(function () {
                self.interval = interval;
                ajax.jsonRpc("/retrieve-invoice", 'call', {'data':data})
                .then(function (source) {
                    if (source.status === 'MARKED_AS_PAID' || source.status === 'PAID') {
                        source.status = 'done'
                        var amount = 0;
                        var lines = self.pos.get_order().get_paymentlines();
                        var line_name = '';
                        for (var i = 0; i < lines.length; i++) {
                            if (lines[i].paypal_scan_pending) {
                                lines[i].paypal_scan_pending = false;
                                lines[i].src_id = source.id;
                                line_name = lines[i].name;
                                amount = lines[i].amount;
                            }
                        }
                        $('.pos .paymentline.selected.o_pos_paypal_scan_pending .col-tendered.edit ').removeClass('o_pos_paypal_scan_tendered');
                        $('.pos .paymentline.selected').removeClass('o_pos_paypal_scan_pending');
                        $('div.payment-screen.screen span.button.next').addClass('highlight');
                        $('.pos .paymentline.selected .delete-button').hide();
                        $('.pos .paymentline.selected .col-name').text(line_name);
                        $('.refresh-button').hide();
                        clearInterval(interval);
                        self.gui.close_popup('qr_code_popup');
                        self.gui.show_popup('payment_notify', {
                            title: 'Payment Created !!!',
                            body: 'Your payment of ' + self.pos.currency.symbol + '' + amount + ' has been completed successfully.',
                        });
                    } else if (source.status === 'UNPAID' && pollCount < MAX_POLL_COUNT) {
                        pollCount += 1;
                    } else if (pollCount == MAX_POLL_COUNT) {
                        clearInterval(interval);
                        self.gui.close_popup('qr_code_popup');
                        self.gui.show_popup('error', {
                            'title': _t('Server TimeOut'),
                            'body': _t("It's been quite long, please click on the refersh button on paymentline to restart payment"),
                        });
                        self.pos.get_order().selected_paymentline.is_paypal_payment_failed = true;
                    } else {
                        console.log("---status----", source.status)
                        clearInterval(interval);
                        self.gui.close_popup('qr_code_popup');
                        self.gui.show_popup('error', {
                            'title': _t('Payment Failed!'),
                            'body': _t("The Payment has been failed, Please try again!!"),
                        });
                        $("tbody tr.paymentline td.refresh-button i.fa.fa-refresh").removeClass('fa-spin');
                    }
                }).catch(function (error) {
                    console.log("erroerr",error)
                    self.gui.show_popup('error', {
                        'title': _t('Payment Failed!'),
                        'body': _t("Please check the internet connection!! Click on the refresh button to try again!!"),
                    });
                    clearInterval(interval);
                    self.pos.get_order().selected_paymentline.is_paypal_payment_cancel = true;
                });
            }, 7000);
        }
    });

    gui.define_popup({
        name: 'qr_code_popup',
        widget: QRcodePopup
    });


    screens.PaymentScreenWidget.include({

        show: function () {
            var self = this;
            self._super();
            $('.paymentlines-container').unbind().on('click', '.refresh-button', function (event) {
                var lines = self.pos.get_order().get_paymentlines();
                var selected_paymentline = self.pos.get_order().selected_paymentline;
                var due = 0;
                for (var i = 0; i < lines.length; i++) {
                    if (lines[i].paypal_payment_pending) {
                        due = lines[i].amount;
                        break;
                    }
                }
                if(self.pos.config.type_of_payment_screen == 'pos'){
                    var txn_amount = selected_paymentline.txn_amount;
                                if (selected_paymentline && selected_paymentline.is_paypal_payment_failed && due == txn_amount) {
                                    self.pos.gui.show_popup('qr_code_popup', {
                                        'title': 'Paypal Payment',
                                        'vals':selected_paymentline.pos_txn_data,
                                        'total_amount':self.pos.chrome.format_currency(self.pos.get_order().selected_paymentline.amount),
                                    });
                                } 
                                else{
                                    self.pay_via_paypal(due_amount);
                                }
                                    }
                else{
                    if(self.pos.db.pos_paypal_screen_data){
                    rpc.query({
                        'method':'refresh_paymentline',
                        'model':'pos.payment.transaction',
                        'args':[selected_paymentline.payment_txn_id,self.pos.db.pos_paypal_screen_data.id]
                        }).catch(function(e){
                            self.pos.chrome.gui.show_popup('error', {
                                'title': _t('Error'),
                                'body': _t("Please Check The Internet Connection."),
                            });
                        })
                    }
                    }

                    $('.paymentline.selected .refresh-button .fa-refresh').addClass('fa-spin')
                });
        },

        click_paymentmethods: function (id) {
            var self = this;
            var payment_method = null;
            var current_order = self.pos.get_order();
            var due = current_order.get_due();
            for (var i = 0; i < this.pos.payment_methods.length; i++) {
                if (this.pos.payment_methods[i].id === id) {
                    payment_method = this.pos.payment_methods[i];
                    break;
                }
            }
            if (payment_method.paypal_payment_method) {
                if (self.pos.db.paypalApiKey) {
                    var existing_line = self.check_existing_paypal_line();
                    var selected_paymentline = null;
                    if (existing_line) {
                        this.gui.show_popup('error', {
                            'title': _t('Error'),
                            'body': _t('One paypal payment scan already pending.'),
                        });
                    } else if (due > 0) {
                        this._super(id);
                        selected_paymentline = current_order.selected_paymentline;
                        if (selected_paymentline) {
                            selected_paymentline.paypal_payment_pending = true;
                            selected_paymentline.is_paypal_payment_line = true;
                            self.pos.get_order().selected_paymentline.set_amount(due)
                            self.render_paymentlines();
                            self.$('.paymentline.selected .edit').text(self.format_currency_no_symbol(due));
                            self.pay_via_paypal(due);
                            self.$('.next').removeClass('highlight');
                        }
                    } else
                        this._super(id);
                } else
                    this.gui.show_popup('error', {
                        'title': _t('Configuration Error'),
                        'body': _t('Please add the configuration for paypalPay in the backend. Please active a paypalPay Credentials.'),
                    });
            } else {
                this._super(id);
            }

        },


        check_existing_paypal_line: function () {
            var self = this;
            var current_order = self.pos.get_order();
            var existing_paypal_line = null;
            var paymentlines = current_order.get_paymentlines();
            if (self.pos.db.paypal_payment_method) {
                paymentlines.forEach(function (line) {
                    if (line.payment_method.id == self.pos.db.paypal_payment_method.id && line.paypal_payment_pending) {
                        line.is_paypal_payment_line = true;
                        existing_paypal_line = line;
                        return true;
                    }
                });
            }
            return existing_paypal_line;
        },

        create_payment_transaction:function(data,order_ref,amount,config_id,created_from,state){
            var self = this;
            var client_id = null;
            if(self.pos.get_order() && self.pos.get_order().get_client())
                client_id = self.pos.get_order().get_client().id;
            rpc.query({
                'method':'create_payment_transaction',
                'model':'pos.payment.transaction',
                'args':[data,order_ref,amount,config_id,created_from,self.pos.chrome.format_currency(amount),client_id,state]
            }).then(function(res){
                console.log("******Result*********",res);
                self.pos.get_order().selected_paymentline.payment_txn_id = res;
            }).catch(function(error){
                console.log("********Error********",error)
            })
        },

        create_paypal_invoice:function(data){

            var self = this;
            var order = self.pos.get_order();
            var send_data = {
                'invoice_number':data.invoice_number,
                'ref':order.name,
                'currency_name':self.pos.currency.name,
                'partner_name':order.get_client() && order.get_client().name,
                'amount':order.get_total_with_tax()
            }
            ajax.jsonRpc("/create-invoice", 'call', {'data':send_data,'access_token':data.access_token})
            .then(function (vals) {
                vals['access_token'] = data.access_token;
                vals['txn_id'] = vals.href.split('invoices/')[1];
                var selected_paymentline = self.pos.get_order().selected_paymentline;
                if(self.pos.config.type_of_payment_screen == 'pos'){
                    selected_paymentline.pos_txn_data = vals;
                    selected_paymentline.txn_amount = selected_paymentline.amount;
                    self.create_payment_transaction(vals,self.pos.get_order().name,selected_paymentline.amount,false,'pos','draft');
                    self.pos.gui.show_popup('qr_code_popup', {
                        'title': 'Paypal Payment',
                        'vals':vals,
                        'total_amount':self.pos.chrome.format_currency(self.pos.get_order().selected_paymentline.amount),
                    });
                }
                else{
                    self.create_payment_transaction(vals,self.pos.get_order().name,selected_paymentline.amount,self.pos.db.pos_paypal_screen_data.id,'screen','draft');
                    if(selected_paymentline.interval)
                        selected_paymentline.interval = null;
                    var interval = setInterval(function () {
                        selected_paymentline.interval = interval;
                    ajax.jsonRpc("/retrieve-invoice", 'call', {'data':vals})
                    .then(function (source) {
                            if(source && (source.status == "MARKED_AS_PAID" || source.status === 'PAID')){
                                var amount = 0;
                                var lines = self.pos.get_order().get_paymentlines();
                                var line_name = '';
                                for (var i = 0; i < lines.length; i++) {
                                    if (lines[i].paypal_payment_pending) {
                                        lines[i].paypal_payment_pending = false;
                                        lines[i].src_id = source.id;
                                        line_name = lines[i].name;
                                        amount = lines[i].amount;
                                    }
                                }
                                $('.pos .paymentline.selected.o_pos_paypal_scan_pending .col-tendered.edit ').removeClass('o_pos_paypal_scan_tendered');
                                $('.pos .paymentline.selected').removeClass('o_pos_paypal_scan_pending');
                                $('div.payment-screen.screen span.button.next').addClass('highlight');
                                $('.pos .paymentline.selected .delete-button').hide();
                                $('.pos .paymentline.selected .col-name').text('Paypal');
                                $('.refresh-button').hide();

                                rpc.query({
                                    'method': 'update_payment_status',
                                    'model':'pos.payment.transaction',
                                    'args':[true,source.status,selected_paymentline.payment_txn_id,self.pos.db.pos_paypal_screen_data.id,false]
                                });
                                self.pos.get_order().selected_paymentline.paypal_payment_pending = false;
                                clearInterval(selected_paymentline.interval);
                                selected_paymentline.interval = null;
                                self.gui.show_popup('payment_notify', {
                                    title: 'Payment Created !!!',
                                    body: 'Your payment of ' + self.pos.currency.symbol + '' + amount + ' has been completed successfully.',
                                    failed:false
                                });
                            }
                            if(source.status === 'CANCELLED'){
                                rpc.query({
                                    'method': 'update_payment_status',
                                    'model':'pos.payment.transaction',
                                    'args':[false,source.status,selected_paymentline.payment_txn_id,self.pos.db.pos_paypal_screen_data.id,false]
                                });
                                self.gui.show_popup('error', {
                                    'title': _t('Payment Failed!'),
                                    'body': _t("The Payment has been failed, Please try again!!"),
                                });
                                $("tbody tr.paymentline td.refresh-button i.fa.fa-refresh").removeClass('fa-spin');
                            }
                        }).catch(function(error){
                                clearInterval(selected_paymentline.interval);
                                selected_paymentline.interval = null;
                                console.log("************Error*****",error)

                        });
                
                    },7000);
                }

            });
        },


        pay_via_paypal: function (due_amount) {
            var self = this;
            var selected_paymentline = self.pos.get_order().selected_paymentline;
            $('.pos .paymentline.selected').addClass('o_pos_paypal_scan_pending');
            $('.pos .paymentline.selected.o_pos_paypal_scan_pending .col-tendered.edit ').addClass('o_pos_paypal_scan_tendered');

            ajax.jsonRpc("/create-access-token", 'call', {})
            .then(function (vals) {
                if (vals) {
                    $('.pos .paymentline.selected.o_pos_paypal_scan_pending .refresh-button .fa-refresh').addClass('fa-spin');
                    self.create_paypal_invoice(vals);
                }
                else if(vals.cancellation_reason) {
                    $('.paymentline.selected.o_pos_paypal_scan_pending .refresh-button .fa-refresh').removeClass('fa-spin');
                    self.pos.chrome.gui.show_popup('error', {
                        'title': _t('Error'),
                        'body': _t(result.cancellation_reason),
                    });
                } else {
                    $('.paymentline.selected.o_pos_paypal_scan_pending .refresh-button .fa-refresh').removeClass('fa-spin');
                    self.pos.chrome.gui.show_popup('error', {
                        'title': _t('Error'),
                        'body': _t("Please Check The Backend Configuration May Be The Secret Key And Publishable Key Isn't Right."),
                    });
                }
            });
        },


        validate_order: function (force_validation) {
            if (this.pos.get_order().is_paid() && !this.invoicing) {
                var lines = this.pos.get_order().get_paymentlines();
                for (var i = 0; i < lines.length; i++) {
                    if (lines[i].paypal_payment_pending) {
                        this.pos.get_order().remove_paymentline(lines[i]);
                        this.render_paymentlines();
                    }
                }
            }

            this._super(force_validation);
        },


        render_paymentlines: function () {
            var self = this;
            var order = this.pos.get_order();
            self._super();
            var lines = this.pos.get_order().get_paymentlines();
            var select_paymentline = self.pos.get_order().selected_paymentline;
            for (var i = 0; i < lines.length; i++) {
                var cid = lines[i].cid;
                if (lines[i].paypal_payment_pending && lines[i].is_paypal_payment_line) {
                    $("tbody tr.paymentline[data-cid*='" + cid + "']").addClass('o_pos_paypal_scan_pending')
                    if (!(self.pos.chrome && self.pos.chrome.gui && self.pos.chrome.gui.current_popup) || (self.pos.chrome && self.pos.chrome.gui && self.pos.chrome.gui.current_popup && self.pos.chrome.gui.current_popup.options && self.pos.chrome.gui.current_popup.options.title != 'SCAN ME')) {
                        $("tbody tr.paymentline td.refresh-button i.fa.fa-refresh").removeClass('fa-spin')
                    }

                    $("tbody tr.paymentline[data-cid*='" + cid + "'].o_pos_paypal_scan_pending .col-tendered.edit").addClass('o_pos_paypal_scan_tendered')
                }
                if (!lines[i].paypal_payment_pending && lines[i].is_paypal_payment_line)
                    $("tbody tr.paymentline[data-cid*='" + cid + "'] td.delete-button").hide();


                if (select_paymentline && select_paymentline.paypal_payment_pending) {
                    $('.pos .paymentline.selected').addClass('o_pos_paypal_scan_pending');
                    $(".pos .paymentline.selected.o_pos_paypal_scan_pending .col-tendered.edit").addClass('o_pos_paypal_scan_tendered')
                }
            }
            if (select_paymentline && select_paymentline.is_paypal_payment_line && !select_paymentline.paypal_payment_pending)
                $("tbody tr.paymentline.selected td.delete-button").hide()
        },

        payment_input: function (input) {
            var self = this;
            if (self.pos.get_order() && self.pos.get_order().selected_paymentline && self.pos.get_order().selected_paymentline.is_paypal_payment_line && !self.pos.get_order().selected_paymentline.paypal_payment_pending) {
                console.log("runnnn")
                return;
            } else
                self._super(input);
        },
        click_delete_paymentline: function(cid){
            var self = this;
            var lines = this.pos.get_order().get_paymentlines();
            for ( var i = 0; i < lines.length; i++ ) {
                var line = lines[i];
                if (line.cid === cid && line.is_paypal_payment_line && line.paypal_payment_pending) {
                    clearInterval(line.interval)
                    line.interval = null;
                    var screen_id = false;
                    if(self.pos.db.pos_paypal_screen_data && self.pos.db.pos_paypal_screen_data.id)
                        screen_id = self.pos.db.pos_paypal_screen_data.id;

                    console.log("runnnnnnnnnnnn tranaction")
                    rpc.query({
                        'method': 'update_payment_status',
                        'model':'pos.payment.transaction',
                        'args':[false,'CANCELLED',line.payment_txn_id,screen_id,false]
                    });
                }
            }
            self._super(cid);
        }
    });

});

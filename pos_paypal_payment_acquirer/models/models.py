# -*- coding: utf-8 -*-
#################################################################################
#
#   Copyright (c) 2016-Present Webkul Software Pvt. Ltd. (<https://webkul.com/>)
#   See LICENSE file for full copyright and licensing details.
#   License URL : <https://store.webkul.com/license.html/>
#
#################################################################################
from odoo import fields, models,api
from odoo.exceptions import ValidationError
import json
import logging
_logger = logging.getLogger(__name__)


try:
    import paypal
except Exception as e:
    _logger.error("Python's Paypal Library is not installed.")


class AccountJournal(models.Model):
    _inherit = "pos.payment.method"

    paypal_payment_method = fields.Boolean("Allow Payments Via Paypal")


    @api.model
    def create_paypal_payment_method(self):
        pos_config = self.env['pos.config'].search([])
        journal = self.env['pos.payment.method']
        if pos_config:
            pos_config = pos_config[0]
            ctx = dict(self.env.context, company_id=pos_config.company_id.id)
            paypal_payment_method = journal.with_context(ctx).search([('name','=','Paypal'),('is_cash_count', '=', False)])
            if paypal_payment_method:
                paypal_payment_method.write({'paypal_payment_method':True})
            else:
                paypal_payment_method = journal.with_context(ctx).create({'name':'Paypal','is_cash_count':False,'paypal_payment_method':True})
                if not paypal_payment_method.id in pos_config.payment_method_ids.ids:
                    pos_config.sudo().write({'payment_method_ids':[(4,paypal_payment_method.id)]})


class PosWeChatConfiguration(models.Model):
    _name = "pos_paypal.configuration"
    _description = 'pos_paypal configuration'
    name = fields.Char(string="Name", help="Name of this Paypal configuration")
    publishable_key = fields.Text(string="API Key",required=True, help="Api Key of user to autheticate him on the payment service provider.")
    secret_key = fields.Text(string="Secret API Key",required=True, help="Api Key of user to autheticate him on the payment service provider.")
    active_record = fields.Boolean(default=False,readonly=True)
    type_of_configuration = fields.Selection([('test','Test Credentials'),('live','Live Credentials')],string='Configuration Type',default="test")

    @api.constrains('active_record')
    def validate_single_api_key(self):
        records = self.search([])
        count = 0
        for record in records:
            if record.active_record == True:
                count += 1
        if(count >1):
            raise ValidationError("You can't have two active credentials.")


    def toggle_active_record(self):
        if self.active_record:
            self.active_record = False
        else:
            self.active_record = True

class PosOrder(models.Model):
    _inherit = "pos.order"

    def _payment_fields(self,  order, ui_paymentline):
        result = super(PosOrder, self)._payment_fields( order, ui_paymentline)
        if ui_paymentline.get('src_id'):
            result.update({
                'paypal_src_id':ui_paymentline.get('src_id')
            })
        return result

class PosPayment(models.Model):
    _inherit = 'pos.payment'

    paypal_src_id = fields.Text(string="Paypal Source ID")

class PosPaymentTransaction(models.Model):
    _name = 'pos.payment.transaction'
    _description = 'PosPaymentTransaction'
    _rec_name = 'txn_id'

    payment_amount = fields.Float(string="Payment Amount")
    order_ref = fields.Char(string="Order Ref")
    txn_id = fields.Text(string="Transaction ID")
    state = fields.Selection([('draft','New'),('pending','Pending'),('failed','Failed'),('done','Done')],string="State")
    created_from = fields.Selection([('pos','POS'),('screen','Screen')],string="Created From")
    txn_data = fields.Text(string="Transaction Data")
    fail_reason = fields.Text(string="Reason of Failure")
    amount_with_currency = fields.Char(string="Payment Amount With Currency")
    partner_id = fields.Many2one('res.partner',string="Customer Name")


    @api.model
    def create_payment_transaction(self,data,order_ref,amount,screen_id,created_from,amount_with_currency,partner_id,state):
        transaction_data = json.dumps(data)
        screen_config = False
        if screen_id:
            screen_config = self.env['pos.payment.screen.config'].browse(screen_id)
            screen_config.is_update = True
            screen_config.type_of_screen ='payment'
        vals = {
            'txn_id':data.get('txn_id'),
            'payment_amount':amount,
            'state':state,
            'order_ref':order_ref,
            'txn_data':transaction_data,
            'created_from':created_from,
            'amount_with_currency':amount_with_currency,
            'partner_id':partner_id
        }
        res = self.create(vals)
        if screen_config:
            screen_config.write({
                'type_of_screen':'payment',
                'is_update':True
            })
        return res.id

    @api.model
    def update_payment_status(self,is_update,status,pos_txn_id,screen_config_id,customer_data):
        transaction = self.browse(pos_txn_id)
        vals = {}
        if is_update:
            if status ==  'MARKED_AS_PAID' or status == 'PAID':
                vals.update({
                    'state':'done'
                })
        else:
            vals.update({
                'state':'failed',
                'fail_reason':'Invoice has been cancelled!!'
            })
        transaction.write(vals)
        if screen_config_id:
            screen_config = self.env['pos.payment.screen.config'].browse(screen_config_id)
            config_vals = {
                'type_of_screen':'welcome',
                'is_update':True
            }
            screen_config.write(config_vals)
        
    @api.model
    def refresh_paymentline(self,pos_txn_id,screen_config_id):
        transaction = self.browse(pos_txn_id)
        transaction.state = 'draft'
        screen_config = self.env['pos.payment.screen.config'].browse(screen_config_id)
        screen_config.write({
            'type_of_screen':'payment',
            'is_update':True
        })

    @api.model
    def cancel_popup_payment(self,pos_txn_id):
        transaction = self.browse(pos_txn_id)
        if transaction:
            transaction.write({'state':'failed','fail_reason':'Payment cancelled by user..'})
        
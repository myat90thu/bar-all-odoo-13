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
from odoo.http import request,Response
from odoo import http
import logging
import base64
import requests

import json
_logger = logging.getLogger(__name__)


class PaypalPayment(http.Controller):


    def __init__(self):
        self.current_screen = None

    @http.route('/create-access-token', type='json', auth='none')
    def create_payment_intent(self,**kw):
        paypal_config = request.env['pos_paypal.configuration'].sudo().search([('active_record','=',True)],limit=1)
        url = ''
        if paypal_config.type_of_configuration == 'test':

            url = "https://api.sandbox.paypal.com/v2/invoicing/generate-next-invoice-number"
        else:
            url = "https://api.paypal.com/v2/invoicing/generate-next-invoice-number"

        active_record = request.env['pos_paypal.configuration'].sudo().search([('active_record','=',True)])
        temp = active_record.publishable_key+':'+active_record.secret_key
        message_bytes = temp.encode('ascii')
        credentials_bytes = base64.b64encode(message_bytes)
        credentials = credentials_bytes.decode('ascii')

        payload = 'grant_type=client_credentials'
        headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic '+credentials
        }
        responses = requests.request("POST", url, headers=headers, data = payload)
        invoice_number = self.create_invoice_number(responses.json().get('access_token'))
        data = responses.json()
        data['invoice_number'] = invoice_number.get('invoice_number')
        try:
            return data
        except Exception as e:
            return json.dumps(error=str(e)), 403


    @http.route('/create-invoice', type='json', auth='none')
    def create_invoice(self,**kw):
        paypal_config = request.env['pos_paypal.configuration'].sudo().search([('active_record','=',True)],limit=1)
        url = ''
        if paypal_config.type_of_configuration == 'test':

            url = "https://api.sandbox.paypal.com/v2/invoicing/generate-next-invoice-number"
        else:
            url = "https://api.paypal.com/v2/invoicing/generate-next-invoice-number"
        headers = {
        'Content-Type': 'application/json',
        'Authorization':'Bearer '+kw.get("access_token")
        }
        data = kw.get('data')

        send_data = {
            "detail": {
                "invoice_number": data.get("invoice_number"),
                "reference": data.get("ref"),
                "invoice_date": "2018-11-12",
                "currency_code": data.get("currency_name"),
                "note": "Thank you for your business.",
                "memo": "This is a long contract",
            },
            "amount": {
                "breakdown": {
                "custom": {
                    "label": "Total Charges",
                    "amount": {
                    "currency_code": data.get('currency_name'),
                    "value": data.get('amount')
                    }
                },
                }
            }
        }
        responses = requests.request("POST", url, headers=headers,data=json.dumps(send_data))
        response_data = responses.json()
        res = self.send_invoice(response_data,kw.get('access_token'))
        qr_code = self.generate_qr_code(response_data,kw.get('access_token'))
        response_data['qr_code'] = qr_code
        return response_data


    def send_invoice(self,data,access_token):
        url = data.get('href')+'/send'
        headers = {
        'Content-Type': 'application/json',
        'Authorization':'Bearer '+access_token,
        }
        payload = '{"send_to_recipient":false}'
        headers = {
        'Authorization': 'Bearer '+access_token,
        'Content-Type': 'application/json'
        }

        response = requests.request("POST", url, headers=headers, data = payload)


    @http.route('/retrieve-invoice', type='json', auth='none')
    def retrive_invoice(self,**kw):
        url = kw.get('data').get('href')
        headers = {
        'Content-Type': 'application/json',
        'Authorization':'Bearer '+kw.get('data').get('access_token'),
        }
        response = requests.request("GET", url, headers=headers)
        return response.json()


    def generate_qr_code(self,data,access_token):
        url = data.get('href')+'/generate-qr-code'
        headers = {
        'Content-Type': 'application/json',
        'Authorization':'Bearer '+access_token,
        }
        response = requests.request("POST", url, headers=headers)
        _logger.info("**************qr code response********%r",response.text)
        return response.text


    def create_invoice_number(self,access_token):
        paypal_config = request.env['pos_paypal.configuration'].sudo().search([('active_record','=',True)],limit=1)
        url = ''
        if paypal_config.type_of_configuration == 'test':

            url = "https://api.sandbox.paypal.com/v2/invoicing/generate-next-invoice-number"
        else:
            url = "https://api.paypal.com/v2/invoicing/generate-next-invoice-number"
        headers = {
        'Content-Type': 'application/json',
        'Authorization':'Bearer '+access_token
        }

        responses = requests.request("POST", url, headers=headers)
        return responses.json()


    @http.route('/pos/payment/<int:id>/update', type='json', auth='none')
    def update_payment_screen(self,**kw):
        screen_config = request.env['pos.payment.screen.config'].sudo().browse(kw.get('id'))
        data_to_send = {}
        if kw.get('is_refresh'):
            screen_config.is_update = True
        if(screen_config.is_update and screen_config.related_id.type_of_payment_screen == 'screen'):
            screen_type = screen_config.type_of_screen
            pos_name = screen_config.related_id and screen_config.related_id.name
            company = screen_config.related_id and screen_config.related_id.company_id.name
            if screen_type != kw.get('template_screen_type'):
                if screen_type == 'welcome':
                    self.current_screen = 'welcome'
                    screen_data = screen_config.read([])
                    images = request.env['promotion.image'].sudo().browse(screen_data[0].get('promotions_pictures')).read(['image'])
                    data_to_send.update({
                        'screen_data':screen_data,
                        'images':images,
                        'type_of_screen':screen_type,
                        'pos_name':pos_name,
                        'company':company,
                    })
                else:
                    self.current_screen = 'payment'
                    new_paymentline = request.env['pos.payment.transaction'].sudo().search([('state','=','draft'),('created_from','=','screen')],limit=1,order="id desc")
                    payment_amount = new_paymentline.amount_with_currency
                    data_to_send.update({
                        'type_of_screen':screen_type,
                        'payment_data':new_paymentline.read([]),
                        'pos_name':pos_name,
                        'company':company,
                        'payment_amount':payment_amount,
                        'order_ref':new_paymentline.order_ref
                    })
                    if new_paymentline.partner_id:
                        data_to_send.update({'customer_name':new_paymentline.partner_id.name})

                    
        return data_to_send


    @http.route('/pos/payment/<int:id>/screen', type='http', auth='none')
    def render_pos_payment_screen(self):
        return request.render('pos_paypal_payment_acquirer.pos_payment_screen_template')




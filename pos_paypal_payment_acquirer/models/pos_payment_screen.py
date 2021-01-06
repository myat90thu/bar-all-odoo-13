# -*- coding: utf-8 -*-
#################################################################################
#
#   Copyright (c) 2016-Present Webkul Software Pvt. Ltd. (<https://webkul.com/>)
#   See LICENSE file for full copyright and licensing details.
#   License URL : <https://store.webkul.com/license.html/>
# 
#################################################################################
from odoo import api, fields, models,_
from odoo.exceptions import ValidationError, Warning,UserError
from odoo.http import request
import logging
_logger = logging.getLogger(__name__)


class PosPaymentScreenConfig(models.Model):
	_name = 'pos.payment.screen.config'
	_rec_name = 'related_id'

	url = fields.Text(string="Customer Display Url",compute="compute_url")
	welcome_screen_content = fields.Text(string="Welcome Screen")
	welcome_screen_heading = fields.Char(string="Welcome Screen Title",default="WELCOME")
	welcome_screen_subheading = fields.Char(string="Welcome Screen SubHeading")
	related_id = fields.Many2one('pos.config',string="Pos Config")
	type_of_screen = fields.Selection([('welcome','Welcome Screen'),('payment','Payment')],string="Type Of Screen")
	is_update = fields.Boolean(string="Is Updated")
	promotions_pictures = fields.One2many('promotion.image','promotions_related_id',string="Promotional Pictures")

	@api.depends('related_id')
	def compute_url(self):
		for self_obj in self:
			data = request.httprequest.host_url
			url = '{}pos/payment/{}/screen'.format(data,self.id)
			self_obj.url = url

	@api.constrains('related_id')
	def validate_configs(self):
		records = self.search([])
		count = 0
		for record in records:
			if record.related_id == self.related_id:
				count += 1
		if(count >1):
			raise ValidationError("You can't have two same pos configs.")


	@api.constrains('promotions_pictures')
	def validate_promotional_pics(self):
		if(self.promotions_pictures and len(self.promotions_pictures) > 3):
			raise ValidationError("You can't set more than 3 promotional pictures.")


	def redirect_customer_screen(self):
		base_url = request.httprequest.host_url
		url = '{}pos/payment/{}/screen'.format(base_url,self.related_id.id)
		return {
				"type": "ir.actions.act_url",
				"url": url,
				"target": "new",
				}

	@api.model
	def update_screen_info(self,config_id):
		config = self.browse(config_id)
		config.write({'is_update':False})


	@api.model
	def update_screen_on_pos(self,config_id):
		config = self.browse(config_id)
		config.write({
			'is_update':True,
			'type_of_screen':'welcome'
		})


class Promotions(models.Model):
	_name = 'promotion.image'

	image = fields.Binary(string="Promotional Pictures")
	promotions_related_id = fields.Many2one('pos.payment.screen.config',string="Promotions")

class PosConfig(models.Model):
	_inherit = 'pos.config'

	type_of_payment_screen = fields.Selection([('pos','Pos Payment'),('screen','On Payment Screen')],string="Type Of Payment Screen",default="screen")
	pos_payment_screen = fields.One2many('pos.payment.screen.config','related_id', string="Pos Review Screen")


	def open_screen_configuration(self):
		view_id_tree = self.env.ref('pos_paypal_payment_acquirer.pos_screen_conf_form').id
		if self.pos_payment_screen and self.pos_payment_screen.id:
			return {
				'type': 'ir.actions.act_window',
				'res_model': 'pos.payment.screen.config',
				'view_mode': 'form',
				'res_id':self.pos_payment_screen.id,
				'view_id':view_id_tree,
				'target': 'current'
			}
		else:
			raise Warning("No Payment Screen Settings available for this POS.")

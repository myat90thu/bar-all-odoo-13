# -*- coding: utf-8 -*-
#################################################################################
# Author      : Webkul Software Pvt. Ltd. (<https://webkul.com/>)
# Copyright(c): 2015-Present Webkul Software Pvt. Ltd.
# All Rights Reserved.
#
#
#
# This program is copyright property of the author mentioned above.
# You can`t redistribute it and/or modify it.
#
#
# You should have received a copy of the License along with this program.
# If not, see <https://store.webkul.com/license.html/>
#################################################################################
{
  "name"                 :  "POS Paypal Payment Acquirer",
  "summary"              :  "It provides a handy payment method through which the customer can do their payments via Paypal. They need to scan the qrcode or via customer screen in order to make the payment.",
  "category"             :  "Point Of Sale",
  "version"              :  "1.0",
  "author"               :  "Webkul Software Pvt. Ltd.",
  "license"              :  "Other proprietary",
  "website"              :  "https://www.webkul.com",
  'description'          :  '''Pos paypal payment acquirer, pos paypal, paypal qrcode scanner, paypal payment
                                , pos paypal, payment via paypal, Paypal, pay via paypal, paypal payment method,
                                we chat pay, we chat payment, payment via we chat, pay via we chat, pos we chat, we chat qrcode scanner''',
  "live_test_url"        :  "http://odoodemo.webkul.com/?module=pos_paypal_payment_acquirer&custom_url=/pos/web/#action=pos.ui",
  "depends"              :  [
                             'point_of_sale',
                            ],
  "data"                 :  [
                             'security/ir.model.access.csv',
                             'views/pos_paypal_view.xml',
                             'views/pos_payment_screen_views.xml',
                             'views/templates.xml',
                            ],
  "demo"                  : [
                             'data/demo.xml',
                            ],
  "qweb"                 :  ['static/src/xml/pos_paypal.xml'],
  "images"               :  ['static/description/Banner.png'],
  "active"               :  False,
  "application"          :  True,
  "installable"          :  True,
  "auto_install"         :  False,
  "currency"             :  "USD",
  "price"                :  99,
  "pre_init_hook"        :  "pre_init_check",
}

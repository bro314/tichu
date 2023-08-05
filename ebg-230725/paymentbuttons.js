/* Payment buttons */

define("ebg/paymentbuttons", [
    "dojo",
    "dojo/_base/declare",
    "svelte/index",
    "ebg/expandablesection",
    "ebg/comboajax"
], function(dojo, declare, svelte) {
    return declare("ebg.paymentbuttons", null, {
        constructor: function() {
            this.page = null;
            this.div_id = null;

            this.sections = {};

            // BTC dialog box
            this.btcDialog = null;

            this.bUseCreditCardElements = true;
            this.rollGameBoxesTimeout = null;
        },
        create: function(page) {
            this.page = page;

            if (location.hash == "#paymentcomplete") {
                svelte.bgaMessage({
                    description: window._('Thanks for supporting this service!'),
                });
            }

            // Show images
            dojo.query(".payment_image").forEach(function(node) {
                dojo.attr(node, "src", dojo.attr(node, "data-src"));
            });

            if (
                $("payment_method").innerHTML == "stripe" ||
                $("payment_method").innerHTML == "wechat"
            ) {
                this.initStripe();
            }

            if ($("payment_method").innerHTML == "braintree") {
                this.initBraintree();
            }

            if ($("payment_method").innerHTML == "wechat") {
                this.page.register_subs(
                    dojo.subscribe(
                        "weChatPaymentSuccess",
                        this,
                        "onWeChatPaymentSucceeded"
                    )
                );

                // Set up qrious (qr code generator)
                jQuery(document).ready(function($) {
                    require([g_themeurl + "js/qrcode.min.js"], function() {
                        console.log("qrcode loaded");
                    });
                });
            }
            if ($("payment_method").innerHTML == "paypal") {
                if (window.paypal) {
                    // Already loaded!
                    this.loadPaypalButtons();
                } else {
                    let paypalClientId = $('paypal_client_id').innerHTML;
                    if (paypalClientId) {
                        for (let m of [2, 12]) {
                            if ($('paypal_btn_holder_'+m+'months')) {
                                $('paypal_btn_holder_'+m+'months').innerHTML = window._('Loading...');
                            }
                        }
                        if ($('paypal_btn_holder_offer')) {
                            $('paypal_btn_holder_offer').innerHTML = window._('Loading...');
                        }
                        let currency = $('currency').innerHTML;
                        let script = document.createElement('script');
                        let self = this;
                        script.onload = function () {
                            //do stuff with the script
                            self.loadPaypalButtons();
                        };
                        script.src = "https://www.paypal.com/sdk/js?client-id=" + paypalClientId + "&components=buttons&currency=" + currency.toUpperCase();
                        document.head.appendChild(script);
                    }
                }
            }

            // GA-GTM analytics, list prices displayed
            if ($('payment_buttons_section') && dojo.style('payment_buttons_section', 'display') != 'none')
            {
                analyticsPush({ ecommerce: null });
                analyticsPush({
                  event: 'view_item_list',
                  ecommerce: {
                    payment_type: $("payment_method").innerHTML,
                    items: [
                    {
                      item_id: $("plan_12months").innerHTML,
                      item_name: '12months',
                      item_category: 'membership',
                      coupon: $("payment_coupon") ? $("payment_coupon").innerHTML : '',
                      currency: $("currency").innerHTML,
                      price: this.getBasePrice('12months'),
                      quantity: '1'
                    },
                    {
                      item_id: $("plan_1month").innerHTML,
                      item_name: '1month',
                      item_category: 'membership',
                      coupon: $("payment_coupon") ? $("payment_coupon").innerHTML : '',
                      currency: $("currency").innerHTML,
                      price: this.getBasePrice('1month'),
                      quantity: '1'
                    }]
                  }
                });
            }

            // Link new payment button to old paypal
            dojo.connect($("premium_btn_12months"), "onclick", this, function(
                evt
            ) {
                if (toint($("target_player").innerHTML) < 0) {
                    this.page.showMessage(
                        _(
                            "Please logged in or create an account to purchase or offer a membership."
                        ),
                        "error"
                    );
                    // Note: we used to support "Offer a membership" for visitors, but it is broken at now and it's not sure that we want to fix it.
                    //  => in the meantime, disabled it
                    /* if (typeof this.sections['offer'] != 'undefined') {
                this.sections['offer'].expand();

                if ($('toggleSection_bitcoinpayment') !== null) {
                  $('toggleSection_bitcoinpayment').innerHTML = _(
                    'Offer a Premium membership to a friend or to yourself');
                }

                if ($('more_payment_option_btn') !== null) {
                  $('more_payment_option_btn').parentElement.insertBefore($(
                    'expandable_offer'), $('more_payment_option_btn'));
                  dojo.style(
                    'expandable_offer',
                    'backgroundColor',
                    'rgba(251,236,93,0.7)'
                  );
                  dojo.style('expandable_offer', 'borderRadius', '10px');
                  dojo.style('expandable_offer', 'border', '3px solid orange');
                  dojo.style('expandable_offer', 'marginBottom', '30px');
                  dojo.style('expandable_offer', 'paddingTop', '20px');
                }
              }*/
                    return;
                }

                if (dojo.query(".didnreceive_link_to_follow").length > 0) {
                    // Half registered users
                    this.page.showMessage(
                        _(
                            "Please finish your registration before purchasing a membership."
                        ),
                        "error"
                    );
                    return;
                }

                if( $('confirmEmail') && dojo.style('confirmEmail', 'display')=='block' )
                {
                    // User with unconfirmed email
                    this.page.showMessage(
                        _(
                            "Please finish your registration before purchasing a membership."
                        ),
                        "error"
                    );
                    return;
                }

                if ($("payment_method").innerHTML == "paypal") {
                    $("premium_btn_12months").innerHTML = _("Please wait...");
                    $("paypal_btn_12months").click();
                } else if ($("payment_method").innerHTML == "wechat") {
                    this.onClickWechatButton(
                        $("plan_12months").innerHTML,
                        evt.currentTarget
                    );
                } else {
                    this.onClickPaymentButton($("plan_12months").innerHTML, "12months");
                }
            });
            dojo.connect($("premium_btn_2months"), "onclick", this, function(
                evt
            ) {
                if (toint($("target_player").innerHTML) < 0) {
                    this.page.showMessage(
                        _(
                            "Please logged in or create an account to purchase or offer a membership."
                        ),
                        "error"
                    );
                    // Note: we used to support "Offer a membership" for visitors, but it is broken at now and it's not sure that we want to fix it.
                    //  => in the meantime, disabled it

                    /*  if (typeof this.sections['offer'] != 'undefined') {
              this.sections['offer'].expand();

              if ($('toggleSection_bitcoinpayment') !== null) {
                $('toggleSection_bitcoinpayment').innerHTML = _(
                  'Offer a Premium membership to a friend or to yourself');
              }

              if ($('more_payment_option_btn') !== null) {
                $('more_payment_option_btn').parentElement.insertBefore($(
                  'expandable_offer'), $('more_payment_option_btn'));
                dojo.style(
                  'expandable_offer',
                  'backgroundColor',
                  'rgba(251,236,93,0.7)'
                );
                dojo.style('expandable_offer', 'borderRadius', '10px');
                dojo.style('expandable_offer', 'border', '3px solid orange');
                dojo.style('expandable_offer', 'marginBottom', '30px');
                dojo.style('expandable_offer', 'paddingTop', '20px');
              }
            }*/
                    return;
                }

                if (dojo.query(".didnreceive_link_to_follow").length > 0) {
                    // Half registered users
                    this.page.showMessage(
                        _(
                            "Please finish your registration before purchasing a membership."
                        ),
                        "error"
                    );
                    return;
                }
                if( $('confirmEmail') && dojo.style('confirmEmail', 'display')=='block' )
                {
                    // User with unconfirmed email
                    this.page.showMessage(
                        _(
                            "Please finish your registration before purchasing a membership."
                        ),
                        "error"
                    );
                    return;
                }


                if ($("payment_method").innerHTML == "paypal") {
                    $("premium_btn_2months").innerHTML = _("Please wait...");
                    $("paypal_btn_2months").click();
                } else if ($("payment_method").innerHTML == "wechat") {
                    this.onClickWechatButton(
                        $("plan_1month").innerHTML,
                        evt.currentTarget
                    );
                } else {
                    this.onClickPaymentButton($("plan_1month").innerHTML, "1month");
                }
            });

            dojo.connect($("offer_submit"), "onclick", this, function(evt) {
                if ($("payment_method").innerHTML == "paypal") {
                    this.page.showMessage(
                        _(
                            "Sorry, Paypal is not supported to offer membership. Please choose another payment option below."
                        ),
                        "error"
                    );
                } else {
                    this.onClickPaymentButton("offer", ($("offer_type").value == 12 ? '12months' : '1month'));
                }
            });

            dojo.connect(
                $("more_payment_option_btn"),
                "onclick",
                this,
                function(evt) {
                    dojo.stopEvent(evt);

                    if (typeof mainsite != "undefined") {
                        // On metasite

                        dojo.style(
                            "more_payment_option_btn",
                            "display",
                            "none"
                        );
                        dojo.style("more_payment_option", "display", "block");
                    } else {
                        // On GS
                        window.open(
                            this.page.metasiteurl + "/premium?options&src=morepaymentoptionsbtn",
                            "_blank"
                        );
                    }
                }
            );

            if ($("payment_method").innerHTML == "paypal") {
                dojo.style("more_payment_option_btn", "display", "none");
                dojo.style("more_payment_option", "display", "block");
            }

            // Game box roller
            this.currentGameBox = 0;
            this.rollGameBoxesTimeout = setTimeout(dojo.hitch(this, "rollGameBoxes"), 2000);

            if ($("automatic_renewal")) {
                dojo.connect($("automatic_renewal"), "onclick", this, function(
                    evt
                ) {
                    dojo.stopEvent(evt);

                    this.page.infoDialog(
                        _(
                            "Note: you won't pay anything until the end of your current Premium period."
                        ),
                        _("Please choose a subscription.")
                    );

                    dojo.query(".payment_buttons_block").style(
                        "display",
                        "block"
                    );
                });
            }

            if ($("switch_to_annual")) {
                dojo.connect($("switch_to_annual"), "onclick", this, function(
                    evt
                ) {
                    dojo.stopEvent(evt);

                    this.page.infoDialog(
                        _(
                            "You won't pay anything until the end of your current monthly Premium period."
                        ) +
                            "<br/>" +
                            _(
                                "After that, your membership will be extended by 1 year every year."
                            ),
                        _("Upgrade to yearly subscription")
                    );

                    dojo.query(".payment_buttons_block").style(
                        "display",
                        "block"
                    );
                    dojo.style("monthly_block", "display", "none");
                    dojo.removeClass("yearly_block", "col-md-6");
                    dojo.addClass("yearly_block", "col-md-12");
                    $("premium_btn_12months").innerHTML = _(
                        "Upgrade to yearly subscription"
                    );

                    // Remove payment method switcher
                    dojo.style("more_payment_options_holder", "display", "none");
                });
            }

            // Initialize payment buttons
            dojo.query(".btc_donate").connect(
                "onclick",
                this,
                "onClickBtcDonate"
            );

            this.sections["bitcoinpayment"] = new ebg.expandablesection();
            this.sections["bitcoinpayment"].create(
                this,
                "expandable_bitcoinpayment"
            );

            this.sections["offer"] = new ebg.expandablesection();
            this.sections["offer"].create(this, "expandable_offer");

            if (toint($("target_player").innerHTML) < 0) {
                // Visitor => must be logged
                dojo.query(".player_notlogged_button").style(
                    "display",
                    "inline"
                );
                dojo.query(".player_logged_button").style("display", "none");
            }

            dojo.query(".paypal_payment_button").connect(
                "onclick",
                this,
                "onPaypalBtnClick"
            );

            if ($("cancel_stripe_subscription")) {
                dojo.connect(
                    $("cancel_stripe_subscription"),
                    "onclick",
                    this,
                    "onCancelSubscription"
                );
            }
            if ($("cancel_stripe_subscription_trial")) {
                dojo.connect(
                    $("cancel_stripe_subscription_trial"),
                    "onclick",
                    this,
                    "onCancelSubscription"
                );
            }

            if ($("payment_method").innerHTML == "paypal") {
                dojo.addClass("paymentmethod_paypal", "current_selection");
            } else if ($("payment_method").innerHTML == "wechat") {
                dojo.addClass("paymentmethod_wechat", "current_selection");
            } else {
                dojo.addClass(
                    "paymentmethod_" + $("currency").innerHTML,
                    "current_selection"
                );
            }

            dojo.query(".paymentmethod").connect(
                "onclick",
                this,
                "onPaymentMethodChange"
            );

            this.offerUpdatePrice();

            dojo.connect($("offer_nbr"), "onchange", this, "offerUpdatePrice");
            dojo.connect($("offer_nbr"), "oninput", this, "offerUpdatePrice");
            dojo.connect($("offer_type"), "onchange", this, "offerUpdatePrice");

            this.bOffer = $("offer_membership").innerHTML == 1;

            if (location.hash) {
                // Auto-click on a button if we came here by clicking on button on GS
                let matches = location.hash.match(/:(.+):(.+)$/);
                if (matches) {
                    history.replaceState({}, document.title, window.location.href.split('#')[0]);
                    this.onClickPaymentButton(matches[1], matches[2]);
                }
            }
        },
        destroy: function() {
            console.log("payment buttons destroy");
            clearTimeout(this.rollGameBoxesTimeout)
        },

        offerUpdatePrice: function() {
            var nbr = toint($("offer_nbr").value);
            if ($("offer_type").value == 12) {
                var base_price = $("raw_price_12months").innerHTML;
                base_price = 12 * base_price;
                base_price = Math.round(base_price * 100) / 100;
            } else {
                var base_price = tofloat($("raw_price_1month").innerHTML);
                base_price = Math.round(base_price * 100) / 100;
            }

            var total = base_price * nbr;
            total = Math.round(total * 100) / 100;
            if (! isNaN(total)) {
                $("total_price").innerHTML = total;
            } 
        },

        getBasePrice: function(plan_name) {
            if (plan_name == 'offer') {
                if ($("offer_type").value == 12) plan_name = '12months';
                else plan_name = '1month';
            }

            if (plan_name == '12months') {
                var base_price = $("raw_price_12months").innerHTML;
                base_price = 12 * base_price;
                base_price = Math.round(base_price * 100) / 100;
            } else if (plan_name == '2months') {
                var base_price = tofloat($("raw_price_1month").innerHTML);
                base_price = 2 * Math.round(base_price * 100) / 100;
            } else {
                var base_price = tofloat($("raw_price_1month").innerHTML);
                base_price = Math.round(base_price * 100) / 100;
            }

            return base_price;
        },

        onPaypalBtnClick: function(evt) {
            // paypal_btn_XXXX
            //ga( "send", "event", "Club", "paypal_btn_click", evt.currentTarget.id.substr(11) );
        },

        onClickBtcDonate: function(evt) {
            console.log("$$$$ Event : onClickBtcDonate");
            evt.preventDefault();
            evt.stopPropagation();

            var node = evt.currentTarget.id;
            var months_number = node.split("_")[3];

            //ga( "send", "event", "Club", "bitcoin_btn_click", "months" + months_number );

            this.page.ajaxcall(
                "/account/account/blockchain_prepare_payment.html",
                {
                    months: months_number,
                    target: $("target_player").innerHTML,
                    lock: true
                },
                this,
                function(result) {
                    if (this.btcDialog) {
                        this.btcDialog.destroyRecursive();
                    }

                    this.btcDialog = new dijit.Dialog({});
                    this.btcDialog.autofocus = false;
                    this.btcDialog.refocus = false;
                    this.btcDialog.set("title", _("Pay with Bitcoin"));

                    var html =
                        "<div class='btc_dialog_main'>" +
                        "&bull; " +
                        _(
                            "Got a wallet configured with your brower? Click the link below:"
                        ) +
                        "<div class='btc_link' title='" +
                        _("Click to pay") +
                        "'>" +
                        "<a id='btc_pay_link' href='" +
                        result.btc_pay_uri +
                        "'>Pay <em>" +
                        result.btc_price +
                        " BTC</em> to <em>Board Game Arena</em></a>" +
                        "</div>" +
                        "&bull; " +
                        _("Got a mobile phone wallet? Just scan the QR code:") +
                        "<div class='btc_qrcode'>" +
                        "<img id='btc_pay_qrcode' src='https://chart.googleapis.com/chart?chs=150x150&cht=qr&chl=" +
                        escape(result.btc_pay_uri) +
                        "&choe=UTF-8' title='" +
                        _("Scan to pay") +
                        "' />" +
                        "</div>" +
                        "&bull; " +
                        _(
                            "If you prefer to process your payment manually, please send exactly <em>%f BTC</em> to:"
                        ).replace("%f", result.btc_price) +
                        "<div class='btc_address'><span id='btc_pay_address'>" +
                        result.btc_pay_address +
                        "</span></div>" +
                        "</div>" +
                        "<div id='btc_dialog_footnotes'>" +
                        _(
                            "This bitcoin payment address will be valid for the next 24 hours."
                        ) +
                        "<br />" +
                        _(
                            "Your payment may take some time to process. You'll get a confirmation email when we receive confirmation for the transaction."
                        ) +
                        "<br />" +
                        _(
                            "The rate used for converting the selected donation amount into bitcoins is updated on a regular basis."
                        ) +
                        "</div>" +
                        "<div id='btc_dialog_action'><a id='action_close' class='button' href='welcome'><span>" +
                        _("Done!") +
                        "</span></a></div>";
                    this.btcDialog.set("content", html);

                    dojo.connect($("action_close"), "onclick", this, function(
                        evt
                    ) {
                        evt.preventDefault();
                        this.btcDialog.hide();
                    });

                    this.btcDialog.show();
                },
                function(is_error) {}
            );
        },

        rollGameBoxes: function() {
            if ($("whypremium_catalog")) {
                var bSkipRolling = false;
                var hovered = document.querySelectorAll(":hover");

                var game_box_nbr = dojo.query(
                    "#whypremium_catalog_list .game_box"
                ).length;
                for (var i in hovered) {
                    if (hovered[i].id == "whypremium_catalog") {
                        // Mouse cursor is over the game image, so skip the rolling
                        bSkipRolling = true;
                    }
                }

                if (!bSkipRolling) {
                    if (this.currentGameBox >= game_box_nbr - 1) {
                        // We must reset to the first game
                        this.currentGameBox = 0;
                        dojo.style("whypremium_catalog_list", "left", "0px");
                    }

                    this.currentGameBox++;
                    var size = dojo.style("whypremium_catalog", "width");
                    this.page
                        .slideToObjectPos(
                            "whypremium_catalog_list",
                            "whypremium_catalog",
                            -size * this.currentGameBox,
                            0
                        )
                        .play();
                }

                // ... and loop
                clearTimeout(this.rollGameBoxesTimeout)
                this.rollGameBoxesTimeout = setTimeout(dojo.hitch(this, "rollGameBoxes"), 2000);
            }
        },

        loadPaypalButtons: function() {
            let buttons = [
                {
                    itemId: 0,
                    itemName: 'offer',
                    holderId: 'paypal_btn_holder_offer',
                },
                {
                    itemId: 2,
                    itemName: '2months',
                    holderId: 'paypal_btn_holder_2months',
                    months: 2,
                },
                {
                    itemId: 12,
                    itemName: '12months',
                    holderId: 'paypal_btn_holder_12months',
                    months: 12,
                }
            ];
            for (let button of buttons) {
                let self = this;
                let holder = $(button.holderId);
                if (! holder) continue;
                holder.innerHTML = '';
                paypal.Buttons({
                    fundingSource: paypal.FUNDING.PAYPAL,
                    style: {
                        tagline: false,
                        layout: 'horizontal',
                    },
                    createOrder: function(data, actions) {
                        let quantity = button.itemName == 'offer' ? $("offer_nbr").value : 1;
                        let numMonths = button.itemName == 'offer' ? toint($("offer_type").value) : button.months;
                        analyticsPush({ ecommerce: null });
                        analyticsPush({
                          event: 'add_to_cart',
                          ecommerce: {
                            payment_type: 'paypal',
                            items: [
                                {
                                    item_id: button.itemId,
                                    item_name: button.itemName,
                                    item_category: 'membership',
                                    coupon: $("payment_coupon") ? $("payment_coupon").innerHTML : '',
                                    currency: $("currency").innerHTML,
                                    price: self.getBasePrice(button.itemName),
                                    quantity: quantity + ''
                                }
                            ]
                          }
                        });
                        
                        // Set up the transaction
                        return new Promise(function(resolve, reject) {
                            try {
                                self.page.ajaxcall(
                                    "/premium/premium/createPaypalOrder.html",
                                    {
                                        months: numMonths,
                                        quantity: quantity,
                                        offer: button.itemName == 'offer',
                                        currency: $('currency').innerHTML,
                                        lock: true
                                    },
                                    self,
                                    function(order) {
                                        resolve(order.id);
                                    },
                                    function(error) {
                                        reject(error);
                                    }
                                );
                            } catch (e) {
                                console.log("error", e);
                                svelte.bgaMessage({
                                    type: 'error',
                                    description: window._('Unable to create PayPal order'),
                                });
                                reject("Unable to create PayPal order");
                            }
                        });
                    },
                    onApprove: function(data, actions) {
                        analyticsPush({ ecommerce: null });
                        analyticsPush({
                            event: 'purchase',
                            ecommerce: {
                                currency: $("currency").innerHTML,
                                transaction_id: data.orderID,
                                value: self.getBasePrice(button.itemName),
                                coupon: $("payment_coupon") ? $("payment_coupon").innerHTML : '',
                                payment_type: 'paypal',
                                items: [
                                    {
                                        item_id: button.itemId,
                                        item_name: button.itemName,
                                        item_category: 'membership',
                                        coupon: $("payment_coupon") ? $("payment_coupon").innerHTML : '',
                                        currency: $("currency").innerHTML,
                                        price: self.getBasePrice(button.itemName),
                                        quantity: button.itemName == 'offer' ? $("offer_nbr").value : '1'
                                    }
                                ]
                            }
                        });
                        
                        return new Promise(function (resolve, reject) {
                            self.page.ajaxcall(
                                "/premium/premium/capturePaypalOrder.html",
                                {
                                    order_id: data.orderID,
                                },
                                self,
                                function() {
                                    resolve();
                                    if (button.itemName == 'offer') {
                                        location.href = "premium?confirmpayment&offer";
                                    } else {
                                        location.hash = "#paymentcomplete";
                                        location.reload();
                                    }
                                },
                                reject
                            );
                        });
                    },
                    onCancel: function(data) {
                        // No need to show a cancel dialog, the user remains on the premium page
                        console.log("Order cancelled", data);
                    },
                    onError: function (err) {
                        // Show an error popup
                        console.log("PayPal error!", err);
                        svelte.bgaMessage({
                            type: 'error',
                            description: window._('Unable to complete PayPal order') + ' (' + err + ')',
                        });
                    }
                }).render('#' + button.holderId);
            }
        },

        initStripe: function() {
            if (this.bUseCreditCardElements) {
                // Use Elements

                if (typeof this.bStripeIsLoading == "undefined") {
                    this.bStripeIsLoading = true;

                    var stripe_script = document.createElement("script");
                    stripe_script.setAttribute(
                        "src",
                        "https://js.stripe.com/v3/"
                    );
                    $("stripe_script").appendChild(stripe_script);
                }

                if (typeof Stripe == "undefined") {
                    // Stripe script has not been loaded yet ...

                    setTimeout(dojo.hitch(this, "initStripe"), 100);
                } else {
                    this.stripe = Stripe($("stripe_key").innerHTML);
                    this.stripeElements = this.stripe.elements();

                    // Custom styling can be passed to options when creating an Element.
                    var style = {
                        base: {
                            // Add your base input styles here. For example:
                            fontSize: "14px",
                            fontWeight: 500,
                            color: "black",
                            "::placeholder": {
                                color: "#a1a1a7"
                            }
                        }
                    };

                    // Create an instance of the card Element.
                    this.card = this.stripeElements.create("cardNumber", {
                        style: style,
                        placeholder: _("Card number")
                    });

                    // Add an instance of the card Element into the `card-element` <div>.
                    this.card.mount("#bga_payment_card_placeholder");

                    this.card.addEventListener(
                        "change",
                        dojo.hitch(this, function(event) {
                            var displayError = document.getElementById(
                                "card-errors"
                            );
                            if (event.error) {
                                displayError.textContent = event.error.message;
                                this.shakePaymentWindow();
                            } else {
                                displayError.textContent = "";
                            }

                            // Switch brand logo
                            if (event.brand) {
                                this.setBrandIcon(event.brand);
                            }
                        })
                    );

                    this.cardExpire = this.stripeElements.create("cardExpiry", {
                        style: style
                    });
                    this.cardExpire.mount("#bga_payment_expire");

                    this.cardCVV = this.stripeElements.create("cardCvc", {
                        style: style
                    });
                    this.cardCVV.mount("#bga_payment_cvv");

                    // Create a token or display an error when the form is submitted.
                    var form = document.getElementById("payment-form");
                    form.addEventListener(
                        "submit",
                        dojo.hitch(this, function(event) {
                            event.preventDefault();

                            bOneTimePayment = false;
                            if (
                                typeof current_player_id != "undefined" &&
                                $("target_player").innerHTML !=
                                    current_player_id
                            ) {
                                bOneTimePayment = true;
                            }
                            if (this.bOffer) {
                                bOneTimePayment = true;
                            }

                            if (
                                dojo.hasClass(
                                    "bga_payment_button_wrap",
                                    "Button--disableClick"
                                ) ||
                                dojo.hasClass(
                                    "bga_payment_button_wrap",
                                    "Button--success"
                                )
                            ) {
                                this.page.showMessage(
                                    _(
                                        "Please wait, a payment is already in progress..."
                                    ),
                                    "error"
                                );
                            } else {
                                if (
                                    $("accept_tos").innerHTML != 0 &&
                                    $("agree_tos").checked != true
                                ) {
                                    $("card-errors").textContent = _(
                                        "You must agree with Term of Sales"
                                    );
                                    this.shakePaymentWindow();
                                } else {
                                    analyticsPush({ ecommerce: null });
                                    analyticsPush({
                                        event: 'add_payment_info',
                                        ecommerce: {
                                            currency: $("currency").innerHTML,
                                            value: this.getBasePrice(this.currentPaymentPlanName),
                                            coupon: $("payment_coupon") ? $("payment_coupon").innerHTML : '',
                                            payment_type: 'stripe',
                                            items: [
                                            {
                                              item_id: (this.currentPaymentPlan == 'offer' ? 0 : this.currentPaymentPlan),
                                              item_name: this.currentPaymentPlanName,
                                              item_category: (this.currentPaymentPlan == 'offer' ? 'gift' : 'membership'),
                                              coupon: $("payment_coupon") ? $("payment_coupon").innerHTML : '',
                                              currency: $("currency").innerHTML,
                                              price: this.getBasePrice(this.currentPaymentPlanName),
                                              quantity: (this.currentPaymentPlan == 'offer' ? $("offer_nbr").value : '1')
                                            }
                                            ]
                                        }
                                    });

                                    dojo.addClass(
                                        "bga_payment_button_wrap",
                                        "Button--disableClick"
                                    );
                                    this.latest_bga_button_label = $(
                                        "bga_payment_button"
                                    ).innerHTML;
                                    $("bga_payment_button").innerHTML =
                                        '<i class="fa fa-spinner fa-pulse fa-lg" aria-hidden="true" style="position:relative;top:8px;"></i>';

                                    if (bOneTimePayment) {
                                        if (
                                            this.paymentIntent_secret === null
                                        ) {
                                            this.page.showMessage(
                                                "Error during payment initialization",
                                                "Error"
                                            );
                                            return;
                                        }

                                        this.stripe
                                            .handleCardPayment(
                                                this.paymentIntent_secret,
                                                this.card
                                            )
                                            .then(
                                                dojo.hitch(
                                                    this,
                                                    "stripePaymentResultHandler"
                                                )
                                            );
                                    } else {
                                        this.stripe
                                            .createToken(this.card)
                                            .then(
                                                dojo.hitch(
                                                    this,
                                                    "stripePaymentResultHandler"
                                                )
                                            );
                                    }
                                }
                            }
                        })
                    );

                    dojo.connect(
                        $("bga_payment_close"),
                        "onclick",
                        this,
                        function() {
                            dojo.style("bga_payment_layout", "display", "none");
                        }
                    );

                    // Focus/unfocus marker
                    dojo.connect(
                        this.card,
                        "focus",
                        dojo.hitch(this, function(evt) {
                            dojo.addClass(
                                "bga_card_field",
                                "Fieldset-child--focused"
                            );
                        })
                    );
                    dojo.connect(
                        this.card,
                        "blur",
                        dojo.hitch(this, function(evt) {
                            dojo.removeClass(
                                "bga_card_field",
                                "Fieldset-child--focused"
                            );
                        })
                    );

                    dojo.connect(
                        this.cardExpire,
                        "focus",
                        dojo.hitch(this, function(evt) {
                            dojo.addClass(
                                "bga_cardexpiry_field",
                                "Fieldset-child--focused"
                            );
                        })
                    );
                    dojo.connect(
                        this.cardExpire,
                        "blur",
                        dojo.hitch(this, function(evt) {
                            dojo.removeClass(
                                "bga_cardexpiry_field",
                                "Fieldset-child--focused"
                            );
                        })
                    );

                    dojo.connect(
                        this.cardCVV,
                        "focus",
                        dojo.hitch(this, function(evt) {
                            dojo.addClass(
                                "bga_cardcvc_field",
                                "Fieldset-child--focused"
                            );
                        })
                    );
                    dojo.connect(
                        this.cardCVV,
                        "blur",
                        dojo.hitch(this, function(evt) {
                            dojo.removeClass(
                                "bga_cardcvc_field",
                                "Fieldset-child--focused"
                            );
                        })
                    );

                    dojo.connect(
                        $("security_infos"),
                        "onclick",
                        this,
                        dojo.hitch(this, function() {
                            alert(
                                _(
                                    "Your payment data are NEVER collected, transmitted or stored by Board Game Arena."
                                ) +
                                    "\n" +
                                    _(
                                        "Your infos are collected and processed exclusively by our payment service Stripe.com."
                                    ) +
                                    "\n" +
                                    _(
                                        "We are going to redirect you to Stripe.com privacy policy."
                                    )
                            );
                        })
                    );
                }
            } else {
                // Use Checkout

                if (typeof this.bStripeIsLoading == "undefined") {
                    this.bStripeIsLoading = true;

                    var stripe_script = document.createElement("script");
                    stripe_script.setAttribute(
                        "src",
                        "https://checkout.stripe.com/checkout.js"
                    );
                    $("stripe_script").appendChild(stripe_script);
                }

                if (typeof StripeCheckout == "undefined") {
                    // Stripe script has not been loaded yet ...

                    setTimeout(dojo.hitch(this, "initStripe"), 100);
                } else {
                    this.stripeHandler = StripeCheckout.configure({
                        key: $("stripe_key").innerHTML,
                        image: getStaticAssetUrl("/img/logo/logo.png"),
                        locale: dojoConfig.locale,
                        token: dojo.hitch(this, "payWithStripe")
                    });

                    window.addEventListener(
                        "popstate",
                        dojo.hitch(this, function() {
                            this.stripeHandler.close();
                        })
                    );
                }
            }
        },

        stripePaymentResultHandler: function(result) {
            console.log("Create token result");
            console.log(result);

            bOneTimePayment = false;
            if (
                typeof current_player_id != "undefined" &&
                $("target_player").innerHTML != current_player_id
            ) {
                bOneTimePayment = true;
            }
            if (this.bOffer) {
                bOneTimePayment = true;
            }

            if (result.error) {
                // Inform the customer that there was an error.
                var errorElement = document.getElementById("card-errors");
                errorElement.textContent = result.error.message;

                this.shakePaymentWindow();

                dojo.removeClass(
                    "bga_payment_button_wrap",
                    "Button--disableClick"
                );
                $(
                    "bga_payment_button"
                ).innerHTML = this.latest_bga_button_label;
            } else {
                dojo.removeClass(
                    "bga_payment_button_wrap",
                    "Button--disableClick"
                );
                dojo.addClass("bga_payment_button_wrap", "Button--success");
                $("bga_payment_button").innerHTML =
                    '<i class="fa fa-check-circle-o fa-lg" aria-hidden="true" style="position:relative;top:8px;"></i>';

                if (this.bOffer) {
                    this.showConfirmPayment(true);
                } else if (bOneTimePayment) {
                    // Note: no need to send payment (everything has been done already!)
                    // => so end of the job here :)
                    this.showConfirmPayment(false);
                } else {
                    // Send the token to your server.
                    this.stripeTokenHandler(result.token);
                }
            }
        },

        initBraintree: function() {
            dojo.connect($("bga_payment_close"), "onclick", this, function() {
                dojo.style("bga_payment_layout", "display", "none");
            });

            var formSubmitted = false;

            // Done for testing.  TODO: Integrate on button click.
            require([
                "https://js.braintreegateway.com/web/dropin/1.16.0/js/dropin.min.js"
            ], dojo.hitch(this, function(braintree) {
                braintree.create(
                    {
                        authorization: $("braintree_key").innerHTML,
                        container: "#braintree-dropin",
                        vaultManager: true
                        // paypal: {
                        //     flow: 'vault',
                        // }
                    },
                    dojo.hitch(this, function(err, instance) {
                        if (err) {
                            console.error("Error creating client:", err);
                            return;
                        }

                        var form = document.getElementById(
                            "braintree-payment-form"
                        );
                        form.addEventListener(
                            "submit",
                            dojo.hitch(this, function(event) {
                                event.preventDefault();

                                bOneTimePayment = false;

                                if (
                                    typeof current_player_id != "undefined" &&
                                    $("target_player").innerHTML !=
                                        current_player_id
                                ) {
                                    bOneTimePayment = true;
                                } else if (this.bOffer) {
                                    bOneTimePayment = true;
                                }

                                if (
                                    dojo.hasClass(
                                        "bga_braintree_payment_button_wrap",
                                        "Button--disableClick"
                                    ) ||
                                    dojo.hasClass(
                                        "bga_braintree_payment_button_wrap",
                                        "Button--success"
                                    )
                                ) {
                                    this.page.showMessage(
                                        _(
                                            "Please wait, a payment is already in progress..."
                                        ),
                                        "error"
                                    );
                                } else {
                                    if (
                                        $("braintree_accept_tos").innerHTML !=
                                            0 &&
                                        $("braintree_agree_tos").checked != true
                                    ) {
                                        $(
                                            "braintree-card-errors"
                                        ).textContent = _(
                                            "You must agree with Term of Sales"
                                        );
                                        this.shakePaymentWindow();
                                    } else {
                                        dojo.addClass(
                                            "bga_payment_button_wrap",
                                            "Button--disableClick"
                                        );

                                        instance.requestPaymentMethod(
                                            dojo.hitch(
                                                this,
                                                "braintreePaymentResultHandler"
                                            )
                                        );
                                    }
                                }
                            })
                        );
                    })
                );
            }));
        },

        braintreePaymentResultHandler: function(err, payload) {
            this.latest_bga_button_label = $(
                "bga_braintree_payment_button"
            ).innerHTML;
            $("bga_braintree_payment_button").innerHTML =
                '<i class="fa fa-spinner fa-pulse fa-lg" aria-hidden="true" style="position:relative;top:8px;"></i>';

            if (err) {
                $("card-errors").textContent = err;
                this.shakePaymentWindow();
                $(
                    "bga_braintree_payment_button"
                ).innerHTML = this.latest_bga_button_label;
            } else {
                this.page.showMessage(
                    _(
                        "Please wait few seconds while we are upgrading up your account ..."
                    ),
                    "info"
                );

                var args = {
                    paymentToken: payload.nonce,
                    paymentMethod: $("payment_method").innerHTML,
                    email: $("target_player_email").innerHTML,
                    target: $("target_player").innerHTML,
                    plan: this.currentPaymentPlan,
                    currency: $("currency").innerHTML
                };

                this.page.ajaxcall(
                    "/premium/premium/doPayment.html",
                    args,
                    this,
                    dojo.hitch(this, function(result) {
                        console.log("do payment result");
                        console.log(result);

                        // if (typeof result.requires_action != 'undefined' && result.requires_action) {
                        //   // We need to perform a confirmation (ex: 3D secure)
                        //   var client_secret = result.client_secret;
                        //
                        //   this.page.showMessage(
                        //     _('We are redirecting you to your bank to confirm the payment...'),
                        //     'info'
                        //   );
                        //   dojo.style('bga_payment_layout', 'display', 'none');
                        //
                        //   this.stripe.handleCardPayment(client_secret).then(dojo.hitch(
                        //     this,
                        //     function (result) {
                        //       if (result.error) {
                        //         // Display error.message in your UI.
                        //         this.page.showMessage(
                        //           _('Sorry, the payment have failed :(') + ' ' + result.error,
                        //           'error'
                        //         );
                        //
                        //       } else {
                        //         // The payment has succeeded. Display a success message.
                        //
                        //         if (typeof gotourl != 'undefined') {
                        //           gotourl('premium?confirmpayment');
                        //         } else {
                        //           // Note: on gameserver
                        //           this.page.showMessage(
                        //             _('You are awesome! Starting next game you\'ll enjoy your Premium membership!'),
                        //             'info'
                        //           );
                        //         }
                        //       }
                        //     }
                        //   ));
                        //
                        // } else {
                        if (typeof gotourl != "undefined") {
                            this.showConfirmPayment(false);
                        } else {
                            // Note: on gameserver
                            this.page.showMessage(
                                _(
                                    "You are awesome! Starting next game you'll enjoy your Premium membership!"
                                ),
                                "info"
                            );
                            dojo.style("bga_payment_layout", "display", "none");
                        }
                        // }
                    }),
                    function(is_error) {
                        // In any case, hide the payment one second after
                        setTimeout(function() {
                            dojo.style("bga_payment_layout", "display", "none");
                        }, 1000);
                    }
                );

                // document.getElementById('braintree-payment-form').submit();
                // dojo.style('bga_payment_layout', 'display', 'none');
            }
        },

        setBrandIcon: function(brand) {
            var cardBrandToPfClass = {
                visa: "fa-cc-visa",
                mastercard: "fa-cc-mastercard",
                amex: "fa-cc-amex",
                discover: "fa-cc-discover",
                diners: "fa-cc-dinners-club",
                jcb: "fa-cc-jcb"
            };

            var brandIconElement = document.getElementById("brand-icon");

            if (brand in cardBrandToPfClass) {
                $("brand-icon").src = getStaticAssetUrl(
                    "img/common/cc_" + brand + ".png"
                );
                dojo.style("brand-icon", "display", "block");
            } else {
                dojo.style("brand-icon", "display", "none");
            }
        },

        onClickWechatButton: function(plan_id, button) {
            var base_price_eur = 2400;
            if (plan_id % 100 == 12) {
                base_price_eur = 2400;
            } else {
                base_price_eur = 800;
            }

            this.saveWeChatButtonContent = button.innerHTML;
            button.innerHTML = '<i class="fa fa-spinner fa-spin fa-fw"></i>';

            this.stripe
                .createSource({
                    type: "wechat",
                    amount: base_price_eur,
                    currency: "eur",
                    statement_descriptor:
                        "Player " + $("target_player").innerHTML
                })
                .then(
                    dojo.hitch(this, function(result) {
                        // handle result.error or result.source
                        console.log(result);

                        button.innerHTML = this.saveWeChatButtonContent;

                        if (result.source) {
                            // Success
                            this.wechatDlg = new ebg.popindialog();
                            this.wechatDlg.create("wechatDlg");
                            this.wechatDlg.setTitle(
                                __(
                                    "lang_mainsite",
                                    "Please use your WeChat app to confirm the payment"
                                )
                            );

                            var html = '<div id="wechatContent">';
                            html +=
                                "<p>" +
                                _(
                                    "Note: because WeChat is doing its own currency conversion, the amount displayed below may be slightly different that our price. Sorry about this."
                                ) +
                                "</p>";

                            html +=
                                '<div id="qrcode" style="margin:auto;width:256px;height:256px;margin-top: 50px;margin-bottom: 50px;"></div>';

                            html +=
                                "<p style='text-align:center'><a href='" +
                                result.source.wechat.qr_code_url +
                                "' target='_blank'>" +
                                _("... or click here to open your WeChap app") +
                                "</a></p>";
                            html += "</div>";

                            this.wechatDlg.setContent(html);
                            this.wechatDlg.show();

                            new QRCode(document.getElementById("qrcode"), {
                                text: result.source.wechat.qr_code_url,
                                width: 256,
                                height: 256,
                                colorDark: "#000000",
                                colorLight: "#ffffff",
                                correctLevel: QRCode.CorrectLevel.H
                            });
                        } else {
                            this.page.showMessage(
                                "Error during wechat source creation",
                                "error"
                            );
                            console.error(result.error);
                        }
                    })
                );
        },

        onWeChatPaymentSucceeded: function() {
            if (this.wechatDlg) {
                this.wechatDlg.destroy();

                if (typeof gotourl != "undefined") {
                    this.showConfirmPayment(false);
                } else {
                    // Note: on gameserver
                    this.page.showMessage(
                        _(
                            "You are awesome! Starting next game you'll enjoy your Premium membership!"
                        ),
                        "info"
                    );
                }
            }
        },

        onClickPaymentButton: function(plan_id, plan_name) {
            if (typeof mainsite == "undefined") {
                // If on the GS, we need to redirect to the mainsite in a new window
                // See #898
                window.open(
                    this.page.metasiteurl + "/premium#c:" + plan_id + ":" + plan_name,
                    "_blank"
                );
                return;
            }

            var descr = "";
            var sub_desc = "";
            var bOneTimePayment = false;


            var button_label = _("Subscribe");

            if ($("payment_method").innerHTML === "stripe") {
                dojo.style("payment-form", "display", "block");
            }

            if ($("payment_method").innerHTML === "braintree") {
                dojo.style("braintree-payment-form", "display", "block");
                $("planId").value = plan_id;
            }

            if ($("accept_tos").innerHTML == 1) {
                // Users for France => need a more explicit button
                if (plan_id % 100 == 2) {
                    button_label = dojo.string.substitute(
                        _("Subscribe for ${price}"),
                        {
                            price: $("price_1month").innerHTML
                        }
                    );
                } else if (plan_id % 100 == 12) {
                    button_label = dojo.string.substitute(
                        _("Subscribe for ${price}"),
                        {
                            price: $("price_12months").innerHTML
                        }
                    );
                }
            }

            if (
                typeof current_player_id != "undefined" &&
                $("target_player").innerHTML != current_player_id
            ) {
                button_label = _("Offer membership");
                bOneTimePayment = true;
            }

            if (plan_id == "offer") {
                button_label = _("Buy Premium codes");
                bOneTimePayment = true;
            }

            this.page.ajaxcall(
                "/premium/premium/paymentTrack.html",
                {track:"CLICKED "+plan_id+' '+$("currency").innerHTML+' '+$("payment_method").innerHTML},this, dojo.hitch(this, function(result) {})
            );

            analyticsPush({ ecommerce: null });
            analyticsPush({
              event: 'add_to_cart',
              ecommerce: {
                payment_type: $("payment_method").innerHTML,
                items: [
                {
                  item_id: (plan_id == 'offer' ? 0 : plan_id),
                  item_name: plan_name,
                  item_category: (plan_id == 'offer' ? 'gift' : 'membership'),
                  coupon: $("payment_coupon") ? $("payment_coupon").innerHTML : '',
                  currency: $("currency").innerHTML,
                  price: this.getBasePrice(plan_name),
                  quantity: (plan_id == 'offer' ? $("offer_nbr").value : '1')
                }
                ]
              }
            });

            var bUseCreditCardElements = this.bUseCreditCardElements;

            if (bOneTimePayment) {
                // Generate a new payment intent (server side)
                this.paymentIntent_secret = null;

                var args = {
                    plan: plan_id,
                    currency: $("currency").innerHTML,
                    email: $("target_player_email").innerHTML,
                    target: $("target_player").innerHTML
                };

                if (plan_id == "offer") {
                    args.plan = 0;
                    args.nbr = toint($("offer_nbr").value);
                    args.type = toint($("offer_type").value);
                }

                this.page.ajaxcall(
                    "/premium/premium/paymentIntent.html",
                    args,
                    this,
                    dojo.hitch(this, function(result) {
                        this.paymentIntent_secret = result.client_secret;
                    })
                );
            }

            if (plan_id % 100 == 2) {
                descr = _("Monthly membership");
                sub_desc = $("price_1month").innerHTML;

                if (bOneTimePayment) {
                    descr = _("1 month membership");
                }
            } else if (plan_id % 100 == 6) {
                descr = _("6 month membership");
                sub_desc = $("price_6months").innerHTML;
            } else if (plan_id % 100 == 12) {
                descr = _("Yearly membership");
                sub_desc =
                    $("price_12months").innerHTML +
                    " " +
                    $("premium_save_12_months").innerHTML;

                if (bOneTimePayment) {
                    descr = _("1 year membership");
                }
            } else if (plan_id == "offer") {
                if ($("offer_type").value == 12) {
                    descr = _("1 year membership");
                } else if ($("offer_type").value == 1) {
                    descr = _("1 month membership");
                }

                descr += " x" + toint($("offer_nbr").value);

                sub_desc =
                    _("Total price") +
                    ": " +
                    $("total_price_currency").innerHTML;
            }

            if (bUseCreditCardElements) {
                $("bga_payment_name").innerHTML = descr;
                $("bga_payment_descr").innerHTML = sub_desc;
                $("bga_payment_email").innerHTML =
                    _("Account") + ": " + $("target_player_username").innerHTML;
                $("bga_payment_email").title = $(
                    "target_player_email"
                ).innerHTML;
                $("bga_payment_button").innerHTML = button_label;
                $("bga_braintree_payment_button").innerHTML = button_label;
                dojo.removeClass("bga_payment_button_wrap", "Button--success");
                dojo.removeClass(
                    "bga_braintree_payment_button_wrap",
                    "Button--success"
                );

                // Place the window at the top of the screen
                var screencoords = dojo.window.getBox();
                var margin = Math.max(0, (screencoords.h - 400) / 2 - 30);
                if ($("payment_method").innerHTML == "braintree") {
                    margin = Math.max(0, (screencoords.h - 650) / 2 - 30);
                }
                dojo.style("bga_payment_window", "marginTop", margin + "px");

                if ($("accept_tos").innerHTML == 0) {
                    // No need to have an explicit TOS agreement here
                    dojo.style("accept_tos_block", "display", "none");
                    dojo.style("braintree_accept_tos_block", "display", "none");
                } else {
                    dojo.style("accept_tos_block", "display", "block");
                    dojo.style(
                        "braintree_accept_tos_block",
                        "display",
                        "block"
                    );
                }

                if (plan_id == "offer") {
                    $("bga_payment_email").innerHTML = _("BGA Premium codes");
                }

                dojo.style("bga_payment_layout", "display", "block");

                if (typeof this.card != "undefined") {
                    this.card.focus();
                } else if ($("payment_method").innerHTML === "braintree") {
                    scroll(0, 0);
                }
            } else {
                this.stripeHandler.open({
                    name: descr,
                    description: sub_desc,
                    zipCode: false,
                    email: $("target_player_email").innerHTML,
                    bitcoin: false,
                    allowRememberMe: false,
                    panelLabel: button_label
                });
            }

            this.currentPaymentPlan = plan_id;
            this.currentPaymentPlanName = plan_name;
        },

        stripeTokenHandler: function(token) {
            if (this.bOffer) {
                this.page.showMessage(
                    _(
                        "Please wait few seconds while we checking your payment ..."
                    ),
                    "info"
                );
            } else {
                this.page.showMessage(
                    _(
                        "Please wait few seconds while we are upgrading up your account ..."
                    ),
                    "info"
                );
            }

            var args = {
                paymentToken: token.id,
                paymentMethod: $("payment_method").innerHTML,
                email: $("target_player_email").innerHTML,
                target: $("target_player").innerHTML,
                plan: this.currentPaymentPlan,
                currency: $("currency").innerHTML
            };

            if ($("agree_tos").checked) {
                args.tos_agreed = true;
            }

            this.page.ajaxcall(
                "/premium/premium/paymentTrack.html",
                {track:"ATTEMPT "+this.currentPaymentPlan+' '+$("currency").innerHTML+' '+$("payment_method").innerHTML},this, dojo.hitch(this, function(result) {})
            );             

            this.page.ajaxcall(
                "/premium/premium/doPayment.html",
                args,
                this,
                dojo.hitch(this, function(result) {
                    console.log("do payment result");
                    console.log(result);

                    if (
                        typeof result.requires_action != "undefined" &&
                        result.requires_action
                    ) {
                        // We need to perform a confirmation (ex: 3D secure)
                        var client_secret = result.client_secret;

                        this.page.showMessage(
                            _(
                                "We are redirecting you to your bank to confirm the payment..."
                            ),
                            "info"
                        );
                        dojo.style("bga_payment_layout", "display", "none");

                        this.stripe.handleCardPayment(client_secret).then(
                            dojo.hitch(this, function(result) {
                                if (result.error) {
                                    // Display error.message in your UI.
                                    this.page.showMessage(
                                        _("Sorry, the payment have failed :(") +
                                            " " +
                                            result.error.message,
                                        "error"
                                    );
                                } else {
                                    // The payment has succeeded. Display a success message.
                                    analyticsPush({ ecommerce: null });
                                    var transactionId = '';
                                    if (result.paymentIntent && result.paymentIntent.invoice) {
                                        transactionId = result.paymentIntent.invoice;
                                    }
                                    analyticsPush({
                                        event: 'purchase',
                                        ecommerce: {
                                            currency: $("currency").innerHTML,
                                            transaction_id: transactionId,
                                            value: this.getBasePrice(this.currentPaymentPlanName),
                                            coupon: $("payment_coupon") ? $("payment_coupon").innerHTML : '',
                                            payment_type: 'stripe',
                                            items: [
                                            {
                                              item_id: (this.currentPaymentPlan == 'offer' ? 0 : this.currentPaymentPlan),
                                              item_name: this.currentPaymentPlanName,
                                              item_category: (this.currentPaymentPlan == 'offer' ? 'gift' : 'membership'),
                                              coupon: $("payment_coupon") ? $("payment_coupon").innerHTML : '',
                                              currency: $("currency").innerHTML,
                                              price: this.getBasePrice(this.currentPaymentPlanName),
                                              quantity: (this.currentPaymentPlan == 'offer' ? $("offer_nbr").value : '1')
                                            }
                                            ]
                                        }
                                    });

                                    if (typeof gotourl != "undefined") {
                                        this.showConfirmPayment(false);
                                    } else {
                                        // Note: on gameserver
                                        this.page.showMessage(
                                            _(
                                                "You are awesome! Starting next game you'll enjoy your Premium membership!"
                                            ),
                                            "info"
                                        );
                                    }
                                }
                            })
                        );
                    } else {
                        analyticsPush({ ecommerce: null });
                        analyticsPush({
                            event: 'purchase',
                            ecommerce: {
                                currency: $("currency").innerHTML,
                                transaction_id: result.transaction_id ? result.transaction_id : '',
                                value: this.getBasePrice(this.currentPaymentPlanName),
                                coupon: $("payment_coupon") ? $("payment_coupon").innerHTML : '',
                                payment_type: 'stripe',
                                items: [
                                {
                                  item_id: (this.currentPaymentPlan == 'offer' ? 0 : this.currentPaymentPlan),
                                  item_name: this.currentPaymentPlanName,
                                  item_category: (this.currentPaymentPlan == 'offer' ? 'gift' : 'membership'),
                                  coupon: $("payment_coupon") ? $("payment_coupon").innerHTML : '',
                                  currency: $("currency").innerHTML,
                                  price: this.getBasePrice(this.currentPaymentPlanName),
                                  quantity: (this.currentPaymentPlan == 'offer' ? $("offer_nbr").value : '1')
                                }
                                ]
                            }
                        });

                        if (typeof gotourl != "undefined") {
                            this.showConfirmPayment(false);
                        } else {
                            // Note: on gameserver
                            this.page.showMessage(
                                _(
                                    "You are awesome! Starting next game you'll enjoy your Premium membership!"
                                ),
                                "info"
                            );
                            dojo.style("bga_payment_layout", "display", "none");
                        }
                    }
                }),
                function(is_error) {
                    // In any case, hide the payment one second after
                    setTimeout(function() {
                        if ($("bga_payment_layout")) {
                            dojo.style("bga_payment_layout", "display", "none");
                        }
                    }, 1000);
                }
            );
        },

        payWithStripe: function(token) {
            // Note: only used with CHECKOUT

            // You can access the token ID with `token.id`.
            // Get the token ID to your server-side code for use.

            this.page.showMessage(
                _(
                    "Please wait few seconds while we are upgrading up your account ..."
                ),
                "info"
            );

            this.page.ajaxcall(
                "/premium/premium/doPayment.html",
                {
                    paymentToken: token.id,
                    paymentMethod: $("payment_method").innerHTML,
                    email: $("target_player_email").innerHTML,
                    target: $("target_player").innerHTML,
                    plan: this.currentPaymentPlan,
                    currency: $("currency").innerHTML
                },
                this,
                function(result) {
                    if (typeof gotourl != "undefined") {
                        this.showConfirmPayment(false);
                    } else {
                        // Note: on gameserver
                        this.page.showMessage(
                            _(
                                "You are awesome! Starting next game you'll enjoy your Premium membership!"
                            ),
                            "info"
                        );
                    }
                }
            );
        },

        onCancelSubscription: function(evt) {
            dojo.stopEvent(evt);

            if (evt.currentTarget.id == 'cancel_stripe_subscription_trial') {
                // Adapted message: premium ends _immediately_ if the user ends their trial
                this.page.confirmationDialog(
                    _(
                        "If you end your Premium trial, your account will imediately be downgraded to Standard. The automatic membership renewal for your account will be cancelled, and you will not be charged."
                    ),
                    dojo.hitch(this, function() {
                        this.page.ajaxcall(
                            "/premium/premium/cancelSubscription.html",
                            {},
                            this,
                            function(result) {
                                mainsite.gotourl_forcereload("premium");
                                this.page.showMessage(
                                    _(
                                        "Done! The automatic membership renewal has been removed, and your account is not Premium anymore."
                                    ),
                                    "info"
                                );
                            }
                        );
                    })
                );
            } else {
                // Standard message
                this.page.confirmationDialog(
                    _(
                        "Your account will remains Premium until the end of the current period, then there will be no automatic renewal."
                    ),
                    dojo.hitch(this, function() {
                        this.page.ajaxcall(
                            "/premium/premium/cancelSubscription.html",
                            {},
                            this,
                            function(result) {
                                mainsite.gotourl_forcereload("premium");
                                this.page.showMessage(
                                    _(
                                        "Done! The automatic membership renewal has been removed. Your account will be downgraded to Standard at the end of the current period."
                                    ),
                                    "info"
                                );
                            }
                        );
                    })
                );
            }
        },

        showConfirmPayment: function(offer) {
            let url = "premium?confirmpayment" + (offer ? "&offer" : "");
            location.href = url;
        },

        onPaymentMethodChange: function(evt) {
            dojo.stopEvent(evt);

            // paymentmethod_<target>

            var target = evt.currentTarget.id.substr(14);

            var base_page = "premium?";

            if (this.bOffer) {
                base_page += "offer&";
            }

            if (target == "btc") {
                // Enabled bitcoin
                mainsite.gotourl_forcereload(
                    base_page + "paymentmethod=bitcoin"
                );
                this.page.showMessage(
                    _("Done! Please choose a payment button."),
                    "info"
                );
            } else if (target == "paypal") {
                // EUR + paypal
                mainsite.gotourl_forcereload(
                    base_page + "paymentmethod=paypal"
                );
                this.page.showMessage(
                    _("Done! Please choose a payment button."),
                    "info"
                );
            } else if (target == "wechat") {
                // CNY + wechat
                mainsite.gotourl_forcereload(
                    base_page + "paymentmethod=wechat"
                );
                this.page.showMessage(
                    _("Done! Please choose a payment button."),
                    "info"
                );
            } else {
                // Change currency
                if (target == "eur") {
                    mainsite.gotourl_forcereload(base_page + "country=DE");
                } else if (target == "usd") {
                    mainsite.gotourl_forcereload(base_page + "country=US");
                } else if (target == "gbp") {
                    mainsite.gotourl_forcereload(base_page + "country=GB");
                } else if (target == "cad") {
                    mainsite.gotourl_forcereload(base_page + "country=CA");
                } else if (target == "jpy") {
                    mainsite.gotourl_forcereload(base_page + "country=JP");
                }
            }
        },
        shakePaymentWindow: function() {
            // Make the window shake
            dojo.addClass("bga_payment_window", "ModalContainer--animating");
            dojo.addClass(
                "bga_payment_window_content",
                "Modal-animationWrapper Modal-animationWrapper--shake"
            );

            setTimeout(
                dojo.hitch(this, function() {
                    dojo.removeClass(
                        "bga_payment_window",
                        "ModalContainer--animating"
                    );
                    dojo.removeClass(
                        "bga_payment_window_content",
                        "Modal-animationWrapper Modal-animationWrapper--shake"
                    );
                }),
                500
            );
        }
    });
});

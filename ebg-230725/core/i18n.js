//
//  Internationalization
//

define("ebg/core/i18n", ['dojo', 'dojo/_base/declare', 'dojo/i18n'], function (dojo, declare) {
    return declare('ebg.core.i18n', null, {
        constructor: function () {
            this.nlsStrings = {};
            this.activeBundle = '';
            this.jsbundlesversion = '';
        },

        loadBundle: function (bundle) {
            if (this.jsbundlesversion != '') {
                bundle += '-' + this.jsbundlesversion;
            }

            console.log('Loading translation bundle ' + bundle + ' with locale ' + dojo.config.locale.substr(0, 2));
            this.nlsStrings[bundle] = dojo.i18n.getLocalization('ebg', bundle);
        },

        getTranslation: function (bundle, label) {
            if (this.jsbundlesversion != '') {
                bundle += '-' + this.jsbundlesversion;
            }

            if (!this.nlsStrings[bundle]) {
                console.error('Bundle ' + bundle + ' has not been loaded (for string ' + label + ')');
                return label;
            }

            var translation = this.nlsStrings[bundle][label];
            if (translation) {
                return translation;
            }

            return label;
        },

        setActiveBundle: function (bundle) {
            if (this.jsbundlesversion != '') {
                bundle += '-' + this.jsbundlesversion;
            }

            this.activeBundle = bundle;
        },

        getSimpleTranslation: function (label, failOnUnstranslated = false) {
            if (this.activeBundle == '') {
                console.error('No active bundle (string ' + label + ')');
                return label;
            }

            if (!this.nlsStrings[this.activeBundle]) {
                console.error('Bundle ' + this.activeBundle + ' has not been loaded (string = ' + label + ')');
                return label;
            }

            var translation = this.nlsStrings[this.activeBundle][label];
            if (translation) {
                return translation;
            }

            // As requested, if the translated label does not exist, don't
            // fallback on original label (except for english)
            if (failOnUnstranslated && dojo.config.locale !== 'en') {
                throw new Error('String not translated: ' + label);
            }

            return label;
        },
    });
});

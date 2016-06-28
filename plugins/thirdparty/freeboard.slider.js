'use strict';

(function () {
    freeboard.loadWidgetPlugin({
        type_name: 'jquery-slider',
        display_name: 'Slider',
        fill_size: false,
        description: 'Send numeric value to device',
        external_scripts: [
            'https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.11.4/jquery-ui.min.js',
        ],
        settings: [
            {
                name: 'title',
                display_name: 'Widget Title',
                type: 'text',
                default_value: 'Slider',
            },
            {
                name: 'propertyName',
                display_name: 'Key / Property Name',
                type: 'text',
                description: 'key/property of the JSON that will be sent to device',
                default_value: 'value',
            },
            {
                name: 'max',
                display_name: 'Maximum Value',
                type: 'text',
                default_value: '100',
            },
            {
                name: 'min',
                display_name: 'Minimum Value',
                type: 'text',
                default_value: '0',
            },
            {

                name: 'step',
                display_name: 'Step Value',
                default_value: '1',
            },
            {
                name: 'controlTopic',
                display_name: 'Publish Topic',
                description: 'MQTT topic for control data',
                default_value: window.APP_TOPIC_PREFIX + '/control',
            },
            {
                name: 'subscribeTopic',
                display_name: 'Subscribe Topic',
                default_value: window.APP_TOPIC_PREFIX + '/data',
            },
            {
                name: 'sourceControl',
                display_name: 'Data Source Name',
                type: 'option',
                options: [
                    {
                        name: 'default_mqtt',
                        value: 'default_mqtt',
                    },
                ],
                description: '',
                default_value: 'default_mqtt',
            },
        ],

        newInstance: function (settings, callback) {
            callback(new JquerySliderWidget(settings));
        },
    });

    var JquerySliderWidget = function (settings) {
        var _this = this;
        var arrivedData = {};
        var currentSettings = settings;
        var identifier = window.location.pathname.replace(/\W+/g, '') + '-slider-' + Date.now();
        var previousValue;
        var sliderOptions = {
            max: Number(currentSettings.max),
            min: Number(currentSettings.min),
            orientation: 'horizontal',
            range: false,
            step: Number(currentSettings.step),
            change: onSliderChange,
            slide: onSliderSlide,
            value: 0,
        };

        var $element;
        var $parent;
        var $jquicss = $($.parseHTML(
            '<link rel="stylesheet" id="jquiCssLink" href="https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.11.4/themes/smoothness/jquery-ui.min.css">'
        ));

        var mqttSetting = freeboard.getDatasourceSettings(currentSettings.sourceControl);
        var creds = {
            username: mqttSetting.username,
            password: mqttSetting.password,
            mqtt: {
                host: mqttSetting.server,
                port: mqttSetting.port,
            },
            topic: mqttSetting.topic,
        };
        var clientId = 'rqtxn-' + creds.username + '-' + Date.now();
        var client = new Paho.MQTT.Client(creds.mqtt.host, creds.mqtt.port, clientId);

        client.onConnectionLost = onConnectionLost;
        client.onMessageArrived = onMessageArrived;

        var connect = function () {
            client.connect({
                onSuccess: onConnected,
                userName: creds.username,
                password: creds.password,
                useSSL: mqttSetting.use_ssl,
            });
        };

        var disconnect = function () {
            if (client.isConnected()) {
                client.disconnect();
            }
        };

        var onConnected = function () {
            console.log('Slider is Connected');

            client.subscribe(currentSettings.subscribeTopic || window.APP_TOPIC_PREFIX + '/data');
        };

        function createElement(settings, currentValue) {
            currentValue = currentValue || 0;
            var element =
                '<div class="section-title tw-title tw-td" style="clear: both">' +
                    settings.title +
                '</div>' +
                '<div class="slider-container-2">' +
                    '<div class="slider-indicator">' +
                        '<span class="left">' + settings.min + '</span>' +
                        '<span class="right">' + settings.max + '</span>' +
                    '</div>' +
                    '<div class="realslider" id="' + identifier + '"></div>' +
                    '<div class="slider-value-wrapper">' +
                        '<b>' + currentValue + '</b>' +
                    '</div>' +
                '</div>';

            return element;
        }

        function onConnectionLost(responseObject) {
            if (responseObject.errorCode !== 0)
                console.log('onConnectionLost:' + responseObject.errorMessage);
        }

        function onMessageArrived(message) {
            arrivedData.topic = message.destinationName;

            if (mqttSetting.json_data) {
                try {
                    arrivedData.payload = JSON.parse(message.payloadString);
                } catch (ex) {
                    arrivedData.payload = message.payloadString;
                }
            } else {
                arrivedData.payload = message.payloadString;
            }

            var value = arrivedData.payload[currentSettings.propertyName];
            previousValue = value;

            if (typeof value !== 'undefined') {
                $('#' + identifier).slider('value', value);
            }
        }

        function onSliderChange(event, ui) {
            $('#' + identifier).siblings('.slider-value-wrapper')
                .find('b')
                .html(ui.value);

            if (typeof previousValue === 'undefined' || (previousValue != ui.value)) {
                var payload = {};
                payload[currentSettings.propertyName] = Number(ui.value);

                var message = new Paho.MQTT.Message(JSON.stringify(payload));
                message.destinationName = currentSettings.controlTopic;

                client.send(message);
            }
        }

        function onSliderSlide(event, ui) {
            $('#' + identifier).siblings('.slider-value-wrapper')
                .find('b')
                .html(ui.value);
        }

        function reRender($container, $element) {
            $($container).append($element);
            $('#' + identifier).slider(sliderOptions);
        }

        this.render = function render(containerElement) {
            if ($('#jquiCssLink').length < 1) {
                $('head').append($jquicss);
            }

            $parent = $(containerElement);
            $element = $($.parseHTML(createElement(currentSettings)));

            reRender(containerElement, $element);
            connect();
        };

        this.getHeight = function getHeight() { return 2; };

        this.onSettingsChanged = function onSettingsChanged(newSettings) {
            currentSettings = newSettings;

            sliderOptions.max = Number(currentSettings.max);
            sliderOptions.min = Number(currentSettings.min);
            sliderOptions.step = Number(currentSettings.step);

            if ($parent) {
                $element.remove();

                $element = $($.parseHTML(createElement(currentSettings)));

                reRender($parent, $element);
                disconnect();
                connect();
            }
        };

        this.onCalculatedValueChanged = function (settingName, newValue) {};

        this.onDispose = function () {
            disconnect();
        };
    };
}());

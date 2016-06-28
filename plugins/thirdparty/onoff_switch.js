'use strict';

(function () {
    freeboard.loadWidgetPlugin({
        type_name: 'onoff-switch',
        display_name: 'On/Off Switch',
        fill_size: false,
        description: 'Send 1 or 0 to your device to turn on/off stuff.',
        external_scripts: [
            '/js/thirdparty/mqttws31.js',
        ],
        settings: [
            {
                name: 'propertyName',
                display_name: 'Key / Property Name',
                description: 'JSON property that will be used to identify the on/off value',
                default_value: 'state',
            },
            {
                name: 'title',
                display_name: 'Title',
                type: 'text',
                description: '',
                default_value: 'State Switch',
            },
            {
                name: 'uiType',
                display_name: 'UI Type',
                type: 'option',
                options: [
                    {
                        name: 'Switch',
                        value: 'switch',
                    },
                    {
                        name: 'Push Button',
                        value: 'button',
                    },
                ],
                description: '',
                default_value: 'switch',
            },
            {
                name: 'onLabelText',
                display_name: 'ON Label',
                type: 'text',
                description: '',
                default_value: 'ON',
            },
            {
                name: 'offLabelText',
                display_name: 'OFF Label',
                type: 'text',
                description: '',
                default_value: 'OFF',
            },
            {
                name: 'deviceId',
                display_name: 'Device ID',
                type: 'text',
                description: 'Display data only from the device that has this device ID',
            },
            {
                name: 'controlTopic',
                display_name: 'Publish Topic',
                type: 'text',
                description: 'MQTT topic for control data',
                default_value: window.APP_TOPIC_PREFIX + '/control',
            },
            {
                name: 'subscribeTopic',
                type: 'text',
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
            callback(new OnOffSwitch(settings));
        },
    });

    var OnOffSwitch = function (settings) {
        var _this = this;
        var currentSettings = settings;
        var identifier = window.location.pathname.replace(/\W+/g, '') + Date.now();
        var WIDGET_TYPE = 'switch';
        var element = '';

        function createElement(settings) {
            if (settings.uiType === 'switch') {
                element =
                    '<div class="section-title tw-title tw-td" style="clear: both">' +
                        settings.title +
                    '</div>' +
                    '<div class="onoffswitch" style="margin-top: 5px; margin-bottom: 3px">' +
                        '<input type="checkbox" name="onoffswitch" class="onoffswitch-checkbox ' + identifier + ' glx-toggle-state" id="include_legend-onoff">' +
                        '<label class="onoffswitch-label" for="include_legend-onoff" style="height: 27px">' +
                            '<div class="onoffswitch-inner">' +
                                '<span class="on">' + settings.onLabelText + '</span>' +
                                '<span class="off">' + settings.offLabelText + '</span>' +
                            '</div>' +
                            '<div class="onoffswitch-switch"></div>' +
                        '</label>' +
                    '</div>';
            } else {
                var state = currentState ? 'on' : 'off';
                var text = currentState ? settings.onLabelText : settings.offLabelText;

                element =
                    '<div class="' + identifier + '">' +
                        '<h2 class="section-title tw-title tw-d" style="clear: both">' +
                            settings.title +
                        '</h2>' +
                        '<div class="glx-indicator indicator-light ' + state + '" style="cursor: pointer; display: block"></div>' +
                        '<div class="indicator-text" style="width: 85%; float: right; position: relative">' + text + '</div>' +
                    '</div>';
            }

            return element;
        }

        var currentState = 0;
        var arrivedData = {};
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
        var $mainElement;

        client.onConnectionLost = onConnectionLost;
        client.onMessageArrived = onMessageArrived;

        var $control;

        var connect = function () {
            client.connect({
                onSuccess: onSuccess,
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

        var onSuccess = function () {
            console.log('Connected');
            client.subscribe(currentSettings.subscribeTopic || window.APP_TOPIC_PREFIX + '/data');
        };

        function onConnectionLost(responseObject) {
            if (responseObject.errorCode !== 0)
                console.log('onConnectionLost:' + responseObject.errorMessage);
        };

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

            currentState = arrivedData.payload[currentSettings.propertyName];

            if ($control) {
                if (currentSettings.deviceId && arrivedData.payload.deviceId) {
                    if (currentSettings.deviceId !== arrivedData.payload.device_id) {
                        return false;
                    }
                }

                if (arrivedData.payload[currentSettings.propertyName]) {
                    if (currentSettings.uiType === 'switch') {
                        if (!$control.prop('checked'))
                            $control.trigger('click');
                    } else {
                        var oldClass = $control.find('.indicator-light').attr('class');
                        var newAttr = getNewAttr(currentState, currentSettings);

                        $control.find('.indicator-light').removeClass(oldClass).addClass(newAttr._class);
                        $control.find('.indicator-text').html(newAttr.text);
                    }
                } else if (arrivedData.payload[currentSettings.propertyName] === 0) {
                    if (currentSettings.uiType === 'switch') {
                        if ($control.prop('checked')) {
                            $control.trigger('click');
                        }
                    } else {
                        var oldClass = $control.find('.indicator-light').attr('class');
                        var newAttr = getNewAttr(currentState, currentSettings);

                        $control.find('.indicator-light').removeClass(oldClass).addClass(newAttr._class);
                        $control.find('.indicator-text').html(newAttr.text);
                    }
                }
            }
        };

        function getNewAttr(state, settings) {
            var newText = state
                ? settings.onLabelText
                : settings.offLabelText;
            var newClass = 'indicator-light ' + (state ? 'on' : 'off');

            return {
                _class: newClass,
                text: newText,
            };
        }

        function onClick(event) {
            var newState = $(event.target).prop('checked') ? 1 : 0;
            var faked = event.pageX === 0 && event.pageY === 0;

            if (!faked) {
                var jsonMsg = {};
                jsonMsg[currentSettings.propertyName] = newState;

                var Message = new Paho.MQTT.Message(JSON.stringify(jsonMsg));
                Message.destinationName = currentSettings.controlTopic;

                currentState = newState;

                client.send(Message);
            }
        }

        function onButtonClick(event) {
            var oldClass = $(event.target).attr('class');
            var newState = oldClass.indexOf('on') >= 0 ? 0 : 1;
            var newAttr = getNewAttr(newState, currentSettings);

            $(event.target).removeClass(oldClass).addClass(newAttr._class);
            $(event.target).siblings('.indicator-text').html(newAttr.text);

            var jsonMsg = {};
            jsonMsg[currentSettings.propertyName] = newState;

            var Message = new Paho.MQTT.Message(JSON.stringify(jsonMsg));
            Message.destinationName = currentSettings.controlTopic;

            currentState = newState;

            client.send(Message);
        }

        this.render = function (containerElement) {
            $mainElement = $($.parseHTML(createElement(currentSettings)));
            $(containerElement).append($mainElement);

            if (currentSettings.uiType === 'switch')
                $('body').on('click', '.' + identifier, onClick);
            else if (currentSettings.uiType === 'button')
                $('body').on('click', '.' + identifier + ' .indicator-light', onButtonClick);

            $control = $('.' + identifier);

            connect();
        };

        this.getHeight = function () {
            return 1;
        };

        this.onSettingsChanged = function (newSettings) {
            currentSettings = newSettings;

            var $element = $('.' + identifier).parent();

            if (currentSettings.uiType === 'switch') {
                if ($element) {
                    $element.find('.on').html(currentSettings.onLabelText);
                    $element.find('.off').html(currentSettings.offLabelText);
                }
            } else {
                var newAttr = getNewAttr(currentState, currentSettings);
                $('.' + identifier).find('.indicator-text').html(newAttr.text);
            }
        };

        this.onCalculatedValueChanged = function (settingName, newValue) {};

        this.onDispose = function () {
            disconnect();
        };
    };
}());

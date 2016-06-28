'use strict';

function EVALUATE_STRING(source, statement) {
    var keys = Object.keys(source);
    var str = statement;

    keys.forEach(function (key) {
        str = str.replace('{{ ' + key + ' }}', source[key]);
    });

    try {
        return eval(str);
    } catch (ex) {
        return false;
    }
}

(function () {
    freeboard.loadWidgetPlugin({
        type_name: 'chartjs-2d-line',
        display_name: 'Chart.js Line',
        fill_size: false,
        description: 'Display line chart using chart.js',
        external_scripts: [
            'https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.13.0/moment.min.js',
            'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/2.1.6/Chart.min.js',
        ],
        settings: [
            {
                name: 'title',
                display_name: 'Widget Title',
                type: 'text',
                default_value: 'Line Chart',
            },
            {
                name: 'xAxisProp',
                display_name: 'X Axis Property Name',
                type: window.DATA_PROPERTIES_OPTIONS.length > 0 ? 'option' : 'text',
                options: window.DATA_PROPERTIES_OPTIONS,
                description: 'key/property of the JSON that will be displayed as x axis value',
            },
            {
                name: 'xTransformFn',
                display_name: 'Transform X Axis Value',
                type: 'text',
                description: "Expression like 'value * 1000' (without quote).",
            },
            {
                name: 'isXAxisTime',
                display_name: 'Is X Axis is a Date?',
                type: 'boolean',
                description: 'Indicating whether that the x axis value is a time',
            },
            {
                name: 'yAxisProp',
                display_name: 'Y Axis Property Name',
                type: window.DATA_PROPERTIES_OPTIONS.length > 0 ? 'option' : 'text',
                options: window.DATA_PROPERTIES_OPTIONS,
                description: 'key/property of the JSON that will be displayed as y axis value',
            },
            {
                name: 'yTransformFn',
                display_name: 'Transform Y Axis Value',
                type: 'text',
                description: "Expression like '{{ value }} * 1000' (without quote). There should be a whitespace between {{, }} and a data property",
            },
            {
                name: 'yAxisMax',
                display_name: 'Y Axis Max Value',
                type: 'text',
                description: 'Maximum value of y axis',
            },
            {
                name: 'yAxisMin',
                display_name: 'Y Axis Min Value',
                type: 'text',
                description: 'Minimum value of y axis',
            },
            {
                name: 'legend',
                display_name: 'Legend',
                type: 'text',
            },
            {
                name: 'deviceId',
                display_name: 'Device ID',
                type: 'text',
                description: 'Display data only from the device that has this device ID',
            },
            {
                name: 'subscribeTopic',
                display_name: 'Subscribe Topic',
                default_value: window.APP_TOPIC_PREFIX + '/data',
            },
            {
                name: 'wholeSource',
                display_name: 'Data Source (JSON)',
                type: 'calculated',
                default_value: 'datasources["default_mqtt"]["msg"]',
            },
        ],

        newInstance: function (settings, callback) {
            callback(new ChartJsLine(settings));
        },
    });

    var ChartJsLine = function (settings) {
        var _this = this;
        var currentSettings = settings;
        var identifier = window.location.pathname.replace(/\W+/g, '') + '-slider-' + Date.now();
        var $parent;
        var $element;
        var $chart;
        var masterData = [];

        function createElement(settings, width, height) {
            return '<div class="section-title tw-title tw-td" style="clear: both">' +
                settings.title +
            '</div>' +

            '<div style="margin-top: 10px">' +
                '<canvas id="' + identifier + '" width="' + width + '" height="' + height + '"></canvas>' +
            '</div>';
        }

        function chartFactory(context, settings) {
            var yAxesScales = [];

            if (settings.yAxisMin || settings.yAxisMax) {
                yAxesScales.push({ ticks: {} });
            }

            if (settings.yAxisMin) {
                yAxesScales[0].ticks.min = Number(settings.yAxisMin);
            }

            if (settings.yAxisMax) {
                yAxesScales[0].ticks.max = Number(settings.yAxisMax);
            }

            return Chart.Line(context, {
                data: {
                    datasets: [
                        {
                            label: settings.legend || settings.title,
                            fill: false,
                            borderColor: '#F90',
                            backgroundColor: '#F90',
                            data: masterData,
                        },
                    ],
                },
                options: {
                    maintainAspectRatio: false,
                    legend: {
                        display: false,
                    },
                    scales: {
                        yAxes: yAxesScales,
                        xAxes: [
                            {
                                type: settings.isXAxisTime ? 'time' : 'linear',
                                position: 'bottom',
                            },
                        ],
                    },
                },
            });
        }

        function reRender(parent, settings) {
            if (!$parent && parent) {
                $parent = $(parent);
            }

            $element = $($.parseHTML(createElement(settings, $parent.width(), 200)));

            $parent.append($element);

            $chart = chartFactory($('#' + identifier), settings);
        }

        this.render = function render(containerElement) {
            reRender(containerElement, currentSettings);
        };

        this.getHeight = function getHeight() { return 4; };

        this.onSettingsChanged = function onSettingsChanged(newSettings) {
            currentSettings = newSettings;
            $element.remove();

            reRender(null, currentSettings);
        };

        this.onCalculatedValueChanged = function (settingName, newValue) {
            if (newValue.device_id && currentSettings.deviceId) {
                if (newValue.device_id !== currentSettings.deviceId) {
                    return false;
                }
            }

            if (!$chart) {
                return false;
            }

            var data = $chart.data.datasets[0].data;
            var threshold = currentSettings.isXAxisTime ? 20 : 30;
            masterData = data;

            if (data.length >= threshold) {
                data.shift();
            }

            var newX = newValue[currentSettings.xAxisProp];
            var newY = newValue[currentSettings.yAxisProp];

            if (currentSettings.yTransformFn) {
                var yValue = EVALUATE_STRING(newValue, currentSettings.yTransformFn);

                if (yValue !== false)
                    newY = yValue;
            }

            if (currentSettings.xTransformFn) {
                var xValue = EVALUATE_STRING(newValue, currentSettings.xTransformFn);

                if (xValue !== false)
                    newX = xValue;
            }

            data.push(
                { x: newX, y: newY }
            );

            $chart.update();
        };

        this.onDispose = function () {
        };
    };
}());

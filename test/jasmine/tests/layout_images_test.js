var Plotly = require('@lib/index');
var Plots = require('@src/plots/plots');
var Images = require('@src/components/images');
var Lib = require('@src/lib');

var d3 = require('d3');
var createGraphDiv = require('../assets/create_graph_div');
var destroyGraphDiv = require('../assets/destroy_graph_div');
var failTest = require('../assets/fail_test');
var mouseEvent = require('../assets/mouse_event');

var jsLogo = 'https://images.plot.ly/language-icons/api-home/js-logo.png';
var pythonLogo = 'https://images.plot.ly/language-icons/api-home/python-logo.png';

describe('Layout images', function() {

    describe('supplyLayoutDefaults', function() {

        var layoutIn,
            layoutOut;

        beforeEach(function() {
            layoutIn = { images: [] };
            layoutOut = { _has: Plots._hasPlotType };
        });

        it('should reject when there is no `source`', function() {
            layoutIn.images[0] = { opacity: 0.5, sizex: 0.2, sizey: 0.2 };

            Images.supplyLayoutDefaults(layoutIn, layoutOut);

            expect(layoutOut.images).toEqual([{
                visible: false,
                _index: 0,
                _input: layoutIn.images[0]
            }]);
        });

        it('should reject when not an array', function() {
            layoutIn.images = {
                source: jsLogo,
                opacity: 0.5,
                sizex: 0.2,
                sizey: 0.2
            };

            Images.supplyLayoutDefaults(layoutIn, layoutOut);

            expect(layoutOut.images).toEqual([]);
        });

        it('should coerce the correct defaults', function() {
            var image = { source: jsLogo };

            layoutIn.images[0] = image;

            var expected = {
                source: jsLogo,
                visible: true,
                layer: 'above',
                x: 0,
                y: 0,
                xanchor: 'left',
                yanchor: 'top',
                sizex: 0,
                sizey: 0,
                sizing: 'contain',
                opacity: 1,
                xref: 'paper',
                yref: 'paper',
                _input: image,
                _index: 0
            };

            Images.supplyLayoutDefaults(layoutIn, layoutOut);

            expect(layoutOut.images[0]).toEqual(expected);
        });

    });

    describe('drawing', function() {

        var gd,
            data = [{ x: [1, 2, 3], y: [1, 2, 3] }];

        beforeEach(function() {
            gd = createGraphDiv();
        });

        afterEach(destroyGraphDiv);

        it('should draw images on the right layers', function() {

            var layer;

            Plotly.plot(gd, data, { images: [{
                source: 'imageabove',
                layer: 'above'
            }]});

            layer = gd._fullLayout._imageUpperLayer;
            expect(layer.length).toBe(1);

            destroyGraphDiv();
            gd = createGraphDiv();
            Plotly.plot(gd, data, { images: [{
                source: 'imagebelow',
                layer: 'below'
            }]});

            layer = gd._fullLayout._imageLowerLayer;
            expect(layer.length).toBe(1);

            destroyGraphDiv();
            gd = createGraphDiv();
            Plotly.plot(gd, data, { images: [{
                source: 'imagesubplot',
                layer: 'below',
                xref: 'x',
                yref: 'y'
            }]});

            layer = gd._fullLayout._imageSubplotLayer;
            expect(layer.length).toBe(1);
        });

        describe('with anchors and sizing', function() {

            function testAspectRatio(xAnchor, yAnchor, sizing, expected) {
                var anchorName = xAnchor + yAnchor;
                Plotly.plot(gd, data, { images: [{
                    source: anchorName,
                    xanchor: xAnchor,
                    yanchor: yAnchor,
                    sizing: sizing
                }]});

                var image = Plotly.d3.select('image'),
                    parValue = image.attr('preserveAspectRatio');

                expect(parValue).toBe(expected);
            }

            it('should work for center middle', function() {
                testAspectRatio('center', 'middle', undefined, 'xMidYMid');
            });

            it('should work for left top', function() {
                testAspectRatio('left', 'top', undefined, 'xMinYMin');
            });

            it('should work for right bottom', function() {
                testAspectRatio('right', 'bottom', undefined, 'xMaxYMax');
            });

            it('should work for stretch sizing', function() {
                testAspectRatio('middle', 'center', 'stretch', 'none');
            });

            it('should work for fill sizing', function() {
                testAspectRatio('invalid', 'invalid', 'fill', 'xMinYMin slice');
            });

        });

    });

    describe('when the plot is dragged', function() {
        var gd,
            data = [{ x: [1, 2, 3], y: [1, 2, 3] }];

        beforeEach(function() {
            gd = createGraphDiv();
        });

        afterEach(destroyGraphDiv);

        it('should not move when referencing the paper', function(done) {
            var image = {
                source: jsLogo,
                xref: 'paper',
                yref: 'paper',
                x: 0,
                y: 0,
                sizex: 0.1,
                sizey: 0.1
            };

            Plotly.plot(gd, data, {
                images: [image],
                dragmode: 'pan',
                width: 600,
                height: 400
            }).then(function() {
                var img = Plotly.d3.select('image').node(),
                    oldPos = img.getBoundingClientRect();

                mouseEvent('mousedown', 250, 200);
                mouseEvent('mousemove', 300, 250);

                var newPos = img.getBoundingClientRect();

                expect(newPos.left).toBe(oldPos.left);
                expect(newPos.top).toBe(oldPos.top);

                mouseEvent('mouseup', 300, 250);
            }).then(done);
        });

        it('should move when referencing axes', function(done) {
            var image = {
                source: jsLogo,
                xref: 'x',
                yref: 'y',
                x: 2,
                y: 2,
                sizex: 1,
                sizey: 1
            };

            Plotly.plot(gd, data, {
                images: [image],
                dragmode: 'pan',
                width: 600,
                height: 400
            }).then(function() {
                var img = Plotly.d3.select('image').node(),
                    oldPos = img.getBoundingClientRect();

                mouseEvent('mousedown', 250, 200);
                mouseEvent('mousemove', 300, 250);

                var newPos = img.getBoundingClientRect();

                expect(newPos.left).toBe(oldPos.left + 50);
                expect(newPos.top).toBe(oldPos.top + 50);

                mouseEvent('mouseup', 300, 250);
            }).then(done);
        });

    });

    describe('when relayout', function() {

        var gd,
            data = [{ x: [1, 2, 3], y: [1, 2, 3] }];

        beforeEach(function(done) {
            gd = createGraphDiv();
            Plotly.plot(gd, data, {
                images: [{
                    source: jsLogo,
                    x: 2,
                    y: 2,
                    sizex: 1,
                    sizey: 1
                }],
                width: 500,
                height: 400
            }).then(done);
        });

        afterEach(destroyGraphDiv);

        it('should update the image if changed', function(done) {
            var img = Plotly.d3.select('image'),
                url = img.attr('xlink:href');

            Plotly.relayout(gd, 'images[0].source', pythonLogo).then(function() {
                var newImg = Plotly.d3.select('image'),
                    newUrl = newImg.attr('xlink:href');
                expect(url).not.toBe(newUrl);
            }).then(done);
        });

        it('should update the image position if changed', function(done) {
            var update = {
                'images[0].x': 0,
                'images[0].y': 1
            };

            var img = Plotly.d3.select('image');

            expect([+img.attr('x'), +img.attr('y')]).toEqual([760, -120]);

            Plotly.relayout(gd, update).then(function() {
                var newImg = Plotly.d3.select('image');
                expect([+newImg.attr('x'), +newImg.attr('y')]).toEqual([80, 100]);
            }).then(done);
        });

        it('should remove the image tag if an invalid source', function(done) {

            var selection = Plotly.d3.select('image');
            expect(selection.size()).toBe(1);

            Plotly.relayout(gd, 'images[0].source', 'invalidUrl').then(function() {
                var newSelection = Plotly.d3.select('image');
                expect(newSelection.size()).toBe(0);
            }).then(done);
        });
    });

    describe('when adding/removing images', function() {

        afterEach(destroyGraphDiv);

        it('should properly add and removing image', function(done) {
            var gd = createGraphDiv(),
                data = [{ x: [1, 2, 3], y: [1, 2, 3] }],
                layout = { width: 500, height: 400 };

            function makeImage(source, x, y) {
                return {
                    source: source,
                    x: x,
                    y: y,
                    sizex: 1,
                    sizey: 1
                };
            }

            function assertImages(cnt) {
                expect(d3.selectAll('image').size()).toEqual(cnt);
            }

            Plotly.plot(gd, data, layout).then(function() {
                assertImages(0);
                expect(gd.layout.images).toBeUndefined();

                return Plotly.relayout(gd, 'images[0]', makeImage(jsLogo, 0.1, 0.1));
            })
            .then(function() {
                assertImages(1);

                return Plotly.relayout(gd, 'images[1]', makeImage(pythonLogo, 0.9, 0.9));
            })
            .then(function() {
                assertImages(2);

                // insert an image not at the end of the array
                return Plotly.relayout(gd, 'images[0]', makeImage(pythonLogo, 0.2, 0.5));
            })
            .then(function() {
                assertImages(3);
                expect(gd.layout.images.length).toEqual(3);

                return Plotly.relayout(gd, 'images[1].visible', false);
            })
            .then(function() {
                assertImages(2);
                expect(gd.layout.images.length).toEqual(3);

                return Plotly.relayout(gd, 'images[1].visible', true);
            })
            .then(function() {
                assertImages(3);
                expect(gd.layout.images.length).toEqual(3);

                // delete not from the end of the array
                return Plotly.relayout(gd, 'images[0]', null);
            })
            .then(function() {
                assertImages(2);
                expect(gd.layout.images.length).toEqual(2);

                return Plotly.relayout(gd, 'images[1]', null);
            })
            .then(function() {
                assertImages(1);
                expect(gd.layout.images.length).toEqual(1);

                return Plotly.relayout(gd, 'images[0]', null);
            })
            .then(function() {
                assertImages(0);
                expect(gd.layout.images).toBeUndefined();

                done();
            });
        });

    });

});

describe('images log/linear axis changes', function() {
    'use strict';

    var mock = {
        data: [
            {x: [1, 2, 3], y: [1, 2, 3]},
            {x: [1, 2, 3], y: [3, 2, 1], yaxis: 'y2'}
        ],
        layout: {
            images: [{
                source: 'https://images.plot.ly/language-icons/api-home/python-logo.png',
                x: 1,
                y: 1,
                xref: 'x',
                yref: 'y',
                sizex: 2,
                sizey: 2
            }],
            yaxis: {range: [1, 3]},
            yaxis2: {range: [0, 1], overlaying: 'y', type: 'log'}
        }
    };
    var gd;

    beforeEach(function(done) {
        gd = createGraphDiv();

        var mockData = Lib.extendDeep([], mock.data),
            mockLayout = Lib.extendDeep({}, mock.layout);

        Plotly.plot(gd, mockData, mockLayout).then(done);
    });

    afterEach(destroyGraphDiv);

    it('doesnt try to update position automatically with ref changes', function(done) {
        // we don't try to figure out the position on a new axis / canvas
        // automatically when you change xref / yref, we leave it to the caller.

        // linear to log
        Plotly.relayout(gd, {'images[0].yref': 'y2'})
        .then(function() {
            expect(gd.layout.images[0].y).toBe(1);

            // log to paper
            return Plotly.relayout(gd, {'images[0].yref': 'paper'});
        })
        .then(function() {
            expect(gd.layout.images[0].y).toBe(1);

            // paper to log
            return Plotly.relayout(gd, {'images[0].yref': 'y2'});
        })
        .then(function() {
            expect(gd.layout.images[0].y).toBe(1);

            // log to linear
            return Plotly.relayout(gd, {'images[0].yref': 'y'});
        })
        .then(function() {
            expect(gd.layout.images[0].y).toBe(1);

            // y and yref together
            return Plotly.relayout(gd, {'images[0].y': 0.2, 'images[0].yref': 'y2'});
        })
        .then(function() {
            expect(gd.layout.images[0].y).toBe(0.2);

            // yref first, then y
            return Plotly.relayout(gd, {'images[0].yref': 'y', 'images[0].y': 2});
        })
        .then(function() {
            expect(gd.layout.images[0].y).toBe(2);
        })
        .catch(failTest)
        .then(done);
    });

    it('keeps the same data value if the axis type is changed without position', function(done) {
        // because images (and images) use linearized positions on log axes,
        // we have `relayout` update the positions so the data value the annotation
        // points to is unchanged by the axis type change.

        Plotly.relayout(gd, {'yaxis.type': 'log'})
        .then(function() {
            expect(gd.layout.images[0].y).toBe(0);
            expect(gd.layout.images[0].sizey).toBeCloseTo(0.765551370675726, 6);

            return Plotly.relayout(gd, {'yaxis.type': 'linear'});
        })
        .then(function() {
            expect(gd.layout.images[0].y).toBe(1);
            expect(gd.layout.images[0].sizey).toBeCloseTo(2, 6);

            return Plotly.relayout(gd, {
                'yaxis.type': 'log',
                'images[0].y': 0.2,
                'images[0].sizey': 0.3
            });
        })
        .then(function() {
            expect(gd.layout.images[0].y).toBe(0.2);
            expect(gd.layout.images[0].sizey).toBe(0.3);

            return Plotly.relayout(gd, {
                'images[0].y': 2,
                'images[0].sizey': 2.5,
                'yaxis.type': 'linear'
            });
        })
        .then(function() {
            expect(gd.layout.images[0].y).toBe(2);
            expect(gd.layout.images[0].sizey).toBe(2.5);
        })
        .catch(failTest)
        .then(done);
    });
});

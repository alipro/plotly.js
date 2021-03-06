var d3 = require('d3');

var Plotly = require('@lib/index');
var Plots = require('@src/plots/plots');
var Lib = require('@src/lib');
var Drawing = require('@src/components/drawing');

var createGraphDiv = require('../assets/create_graph_div');
var destroyGraphDiv = require('../assets/destroy_graph_div');
var mouseEvent = require('../assets/mouse_event');
var selectButton = require('../assets/modebar_button');
var customMatchers = require('../assets/custom_matchers');

/*
 * WebGL interaction test cases fail on the CircleCI
 * most likely due to a WebGL/driver issue
 *
 */

var MODEBAR_DELAY = 500;


describe('Test gl plot interactions', function() {
    'use strict';

    var gd;

    beforeEach(function() {
        jasmine.addMatchers(customMatchers);
    });

    afterEach(function() {
        var fullLayout = gd._fullLayout,
            sceneIds;

        sceneIds = Plots.getSubplotIds(fullLayout, 'gl3d');
        sceneIds.forEach(function(id) {
            var scene = fullLayout[id]._scene;

            if(scene.glplot) scene.destroy();
        });

        sceneIds = Plots.getSubplotIds(fullLayout, 'gl2d');
        sceneIds.forEach(function(id) {
            var scene2d = fullLayout._plots[id]._scene2d;

            if(scene2d.glplot) {
                scene2d.stopped = true;
                scene2d.destroy();
            }
        });

        destroyGraphDiv();
    });

    // put callback in the event queue
    function delay(done) {
        setTimeout(done, 0);
    }

    describe('gl3d plots', function() {
        var mock = require('@mocks/gl3d_marker-arrays.json');

        function mouseEventScatter3d(type, opts) {
            mouseEvent(type, 605, 271, opts);
        }

        function countCanvases() {
            return d3.selectAll('canvas').size();
        }

        beforeEach(function(done) {
            gd = createGraphDiv();

            var mockCopy = Lib.extendDeep({}, mock);

            // lines, markers, text, error bars and surfaces each
            // correspond to one glplot object
            mockCopy.data[0].mode = 'lines+markers+text';
            mockCopy.data[0].error_z = { value: 10 };
            mockCopy.data[0].surfaceaxis = 2;
            mockCopy.layout.showlegend = true;

            Plotly.plot(gd, mockCopy.data, mockCopy.layout).then(function() {
                delay(done);
            });
        });

        describe('scatter3d hover', function() {

            var ptData;

            beforeEach(function(done) {
                gd.on('plotly_hover', function(eventData) {
                    ptData = eventData.points[0];
                });

                mouseEventScatter3d('mouseover');

                delay(done);
            });

            function assertHoverText(xLabel, yLabel, zLabel) {
                var node = d3.selectAll('g.hovertext');
                expect(node.size()).toEqual(1, 'hover text group');

                var tspan = d3.selectAll('g.hovertext').selectAll('tspan')[0];
                expect(tspan[0].innerHTML).toEqual(xLabel, 'x val');
                expect(tspan[1].innerHTML).toEqual(yLabel, 'y val');
                expect(tspan[2].innerHTML).toEqual(zLabel, 'z val');
            }

            it('makes the right hover text and point data', function(done) {

                function hover() {
                    mouseEventScatter3d('mouseover');
                    return delay;
                }

                assertHoverText('x: 140.72', 'y: −96.97', 'z: −96.97');

                expect(Object.keys(ptData)).toEqual([
                    'x', 'y', 'z',
                    'data', 'fullData', 'curveNumber', 'pointNumber'
                ], 'correct hover data fields');

                expect(ptData.x).toBe('140.72', 'x val');
                expect(ptData.y).toBe('−96.97', 'y val');
                expect(ptData.z).toEqual('−96.97', 'z val');
                expect(ptData.curveNumber).toEqual(0, 'curveNumber');
                expect(ptData.pointNumber).toEqual(2, 'pointNumber');

                Plotly.restyle(gd, {
                    x: [['2016-01-11', '2016-01-12', '2017-01-01', '2017-02']]
                })
                .then(hover)
                .then(function() {
                    assertHoverText('x: Jan 1, 2017', 'y: −96.97', 'z: −96.97');

                    return Plotly.restyle(gd, {
                        x: [[new Date(2017, 2, 1), new Date(2017, 2, 2), new Date(2017, 2, 3), new Date(2017, 2, 4)]]
                    });
                })
                .then(hover)
                .then(function() {
                    assertHoverText('x: Mar 3, 2017', 'y: −96.97', 'z: −96.97');

                    return Plotly.update(gd, {
                        y: [['a', 'b', 'c', 'd']],
                        z: [[10, 1e3, 1e5, 1e10]]
                    }, {
                        'scene.zaxis.type': 'log'
                    });
                })
                .then(hover)
                .then(function() {
                    assertHoverText('x: Mar 3, 2017', 'y: c', 'z: 100k');

                    return Plotly.relayout(gd, 'scene.xaxis.calendar', 'chinese');
                })
                .then(hover)
                .then(function() {
                    assertHoverText('x: 二 6, 2017', 'y: c', 'z: 100k');
                })
                .then(done);
            });
        });

        describe('scatter3d click events', function() {
            var ptData;

            beforeEach(function(done) {
                gd.on('plotly_click', function(eventData) {
                    ptData = eventData.points[0];
                });

                // N.B. gl3d click events are 'mouseover' events
                // with button 1 pressed
                mouseEventScatter3d('mouseover', {buttons: 1});

                delay(done);
            });

            it('should have', function() {
                expect(Object.keys(ptData)).toEqual([
                    'x', 'y', 'z',
                    'data', 'fullData', 'curveNumber', 'pointNumber'
                ], 'correct hover data fields');


                expect(ptData.x).toBe('140.72', 'x val click data');
                expect(ptData.y).toBe('−96.97', 'y val click data');
                expect(ptData.z).toEqual('−96.97', 'z val click data');
                expect(ptData.curveNumber).toEqual(0, 'curveNumber click data');
                expect(ptData.pointNumber).toEqual(2, 'pointNumber click data');
            });
        });

        it('should be able to reversibly change trace type', function(done) {
            var sceneLayout = { aspectratio: { x: 1, y: 1, z: 1 } };

            expect(countCanvases()).toEqual(1);
            expect(gd.layout.scene).toEqual(sceneLayout);
            expect(gd.layout.xaxis).toBeUndefined();
            expect(gd.layout.yaxis).toBeUndefined();
            expect(gd._fullLayout._has('gl3d')).toBe(true);
            expect(gd._fullLayout.scene._scene).toBeDefined();

            Plotly.restyle(gd, 'type', 'scatter').then(function() {
                expect(countCanvases()).toEqual(0);
                expect(gd.layout.scene).toEqual(sceneLayout);
                expect(gd.layout.xaxis).toBeDefined();
                expect(gd.layout.yaxis).toBeDefined();
                expect(gd._fullLayout._has('gl3d')).toBe(false);
                expect(gd._fullLayout.scene).toBeUndefined();

                return Plotly.restyle(gd, 'type', 'scatter3d');
            }).then(function() {
                expect(countCanvases()).toEqual(1);
                expect(gd.layout.scene).toEqual(sceneLayout);
                expect(gd.layout.xaxis).toBeDefined();
                expect(gd.layout.yaxis).toBeDefined();
                expect(gd._fullLayout._has('gl3d')).toBe(true);
                expect(gd._fullLayout.scene._scene).toBeDefined();

                done();
            });
        });

        it('should be able to delete the last trace', function(done) {
            Plotly.deleteTraces(gd, [0]).then(function() {
                expect(countCanvases()).toEqual(0);
                expect(gd._fullLayout._has('gl3d')).toBe(false);
                expect(gd._fullLayout.scene).toBeUndefined();

                done();
            });
        });

        it('should be able to toggle visibility', function(done) {
            var objects = gd._fullLayout.scene._scene.glplot.objects;

            expect(objects.length).toEqual(5);

            Plotly.restyle(gd, 'visible', 'legendonly').then(function() {
                expect(objects.length).toEqual(0);

                return Plotly.restyle(gd, 'visible', true);
            }).then(function() {
                expect(objects.length).toEqual(5);

                done();
            });
        });

    });

    describe('gl2d plots', function() {
        var mock = require('@mocks/gl2d_10.json'),
            modeBar, relayoutCallback;

        beforeEach(function(done) {
            gd = createGraphDiv();

            Plotly.plot(gd, mock.data, mock.layout).then(function() {

                modeBar = gd._fullLayout._modeBar;
                relayoutCallback = jasmine.createSpy('relayoutCallback');

                gd.on('plotly_relayout', relayoutCallback);

                delay(done);
            });
        });

        it('has one *canvas* node', function() {
            var nodes = d3.selectAll('canvas');
            expect(nodes[0].length).toEqual(1);
        });

        it('should respond to drag interactions', function(done) {

            function mouseTo(p0, p1) {
                mouseEvent('mousemove', p0[0], p0[1]);
                mouseEvent('mousedown', p0[0], p0[1], { buttons: 1 });
                mouseEvent('mousemove', p1[0], p1[1], { buttons: 1 });
                mouseEvent('mouseup', p1[0], p1[1]);
            }

            jasmine.addMatchers(customMatchers);

            var precision = 5;

            var buttonPan = selectButton(modeBar, 'pan2d');

            var originalX = [-0.022068095838587643, 5.022068095838588];
            var originalY = [-0.21331533513634046, 5.851205650049042];

            var newX = [-0.23224043715846995, 4.811895754518705];
            var newY = [-1.2962655110623016, 4.768255474123081];

            expect(gd.layout.xaxis.autorange).toBe(true);
            expect(gd.layout.yaxis.autorange).toBe(true);
            expect(gd.layout.xaxis.range).toBeCloseToArray(originalX, precision);
            expect(gd.layout.yaxis.range).toBeCloseToArray(originalY, precision);

            // Switch to pan mode
            expect(buttonPan.isActive()).toBe(false); // initially, zoom is active
            buttonPan.click();
            expect(buttonPan.isActive()).toBe(true); // switched on dragmode

            // Switching mode must not change visible range
            expect(gd.layout.xaxis.range).toBeCloseToArray(originalX, precision);
            expect(gd.layout.yaxis.range).toBeCloseToArray(originalY, precision);

            setTimeout(function() {
                relayoutCallback.calls.reset();

                // Drag scene along the X axis
                mouseTo([200, 200], [220, 200]);

                expect(gd.layout.xaxis.autorange).toBe(false);
                expect(gd.layout.yaxis.autorange).toBe(false);

                expect(gd.layout.xaxis.range).toBeCloseToArray(newX, precision);
                expect(gd.layout.yaxis.range).toBeCloseToArray(originalY, precision);

                // Drag scene back along the X axis
                mouseTo([220, 200], [200, 200]);

                expect(gd.layout.xaxis.range).toBeCloseToArray(originalX, precision);
                expect(gd.layout.yaxis.range).toBeCloseToArray(originalY, precision);

                // Drag scene along the Y axis
                mouseTo([200, 200], [200, 150]);

                expect(gd.layout.xaxis.range).toBeCloseToArray(originalX, precision);
                expect(gd.layout.yaxis.range).toBeCloseToArray(newY, precision);

                // Drag scene back along the Y axis
                mouseTo([200, 150], [200, 200]);

                expect(gd.layout.xaxis.range).toBeCloseToArray(originalX, precision);
                expect(gd.layout.yaxis.range).toBeCloseToArray(originalY, precision);

                // Drag scene along both the X and Y axis
                mouseTo([200, 200], [220, 150]);

                expect(gd.layout.xaxis.range).toBeCloseToArray(newX, precision);
                expect(gd.layout.yaxis.range).toBeCloseToArray(newY, precision);

                // Drag scene back along the X and Y axis
                mouseTo([220, 150], [200, 200]);

                expect(gd.layout.xaxis.range).toBeCloseToArray(originalX, precision);
                expect(gd.layout.yaxis.range).toBeCloseToArray(originalY, precision);

                setTimeout(function() {

                    // callback count expectation: X and back; Y and back; XY and back
                    expect(relayoutCallback).toHaveBeenCalledTimes(6);

                    // a callback value structure and contents check
                    expect(relayoutCallback).toHaveBeenCalledWith(jasmine.objectContaining({
                        lastInputTime: jasmine.any(Number),
                        xaxis: [jasmine.any(Number), jasmine.any(Number)],
                        yaxis: [jasmine.any(Number), jasmine.any(Number)]
                    }));

                    done();

                }, MODEBAR_DELAY);

            }, MODEBAR_DELAY);
        });

        it('should be able to toggle visibility', function(done) {
            var OBJECT_PER_TRACE = 5;

            var objects = function() {
                return gd._fullLayout._plots.xy._scene2d.glplot.objects;
            };

            expect(objects().length).toEqual(OBJECT_PER_TRACE);

            Plotly.restyle(gd, 'visible', 'legendonly').then(function() {
                expect(objects().length).toEqual(OBJECT_PER_TRACE);
                expect(objects()[0].data.length).toEqual(0);

                return Plotly.restyle(gd, 'visible', true);
            })
            .then(function() {
                expect(objects().length).toEqual(OBJECT_PER_TRACE);
                expect(objects()[0].data.length).not.toEqual(0);

                return Plotly.restyle(gd, 'visible', false);
            })
            .then(function() {
                expect(gd._fullLayout._plots.xy._scene2d).toBeUndefined();

                return Plotly.restyle(gd, 'visible', true);
            })
            .then(function() {
                expect(objects().length).toEqual(OBJECT_PER_TRACE);
                expect(objects()[0].data.length).not.toEqual(0);
            })
            .then(done);
        });

        it('should clear orphan cartesian subplots on addTraces', function(done) {

            Plotly.newPlot(gd, [], {
                xaxis: { title: 'X' },
                yaxis: { title: 'Y' }
            })
            .then(function() {
                return Plotly.addTraces(gd, [{
                    type: 'scattergl',
                    x: [1, 2, 3, 4, 5, 6, 7],
                    y: [0, 5, 8, 9, 8, 5, 0]
                }]);
            })
            .then(function() {
                expect(d3.select('.subplot.xy').size()).toEqual(0);
                expect(d3.select('.xtitle').size()).toEqual(0);
                expect(d3.select('.ytitle').size()).toEqual(0);
            })
            .then(done);

        });
    });

    describe('gl3d event handlers', function() {
        var modeBar, relayoutCallback;

        beforeEach(function(done) {
            var mockData = [{
                type: 'scatter3d'
            }, {
                type: 'surface', scene: 'scene2'
            }];

            var mockLayout = {
                scene: { camera: { eye: { x: 0.1, y: 0.1, z: 1 }}},
                scene2: { camera: { eye: { x: 2.5, y: 2.5, z: 2.5 }}}
            };

            gd = createGraphDiv();
            Plotly.plot(gd, mockData, mockLayout).then(function() {

                modeBar = gd._fullLayout._modeBar;

                relayoutCallback = jasmine.createSpy('relayoutCallback');

                gd.on('plotly_relayout', relayoutCallback);

                delay(done);
            });
        });

        function assertScenes(cont, attr, val) {
            var sceneIds = Plots.getSubplotIds(cont, 'gl3d');

            sceneIds.forEach(function(sceneId) {
                var thisVal = Lib.nestedProperty(cont[sceneId], attr).get();
                expect(thisVal).toEqual(val);
            });
        }

        describe('modebar click handlers', function() {

            it('button zoom3d should updates the scene dragmode and dragmode button', function() {
                var buttonTurntable = selectButton(modeBar, 'tableRotation'),
                    buttonZoom3d = selectButton(modeBar, 'zoom3d');

                assertScenes(gd._fullLayout, 'dragmode', 'turntable');
                expect(buttonTurntable.isActive()).toBe(true);
                expect(buttonZoom3d.isActive()).toBe(false);

                buttonZoom3d.click();
                assertScenes(gd.layout, 'dragmode', 'zoom');
                expect(gd.layout.dragmode).toBe(undefined);
                expect(gd._fullLayout.dragmode).toBe('zoom');
                expect(buttonTurntable.isActive()).toBe(false);
                expect(buttonZoom3d.isActive()).toBe(true);

                buttonTurntable.click();
                assertScenes(gd._fullLayout, 'dragmode', 'turntable');
                expect(buttonTurntable.isActive()).toBe(true);
                expect(buttonZoom3d.isActive()).toBe(false);
            });

            it('button pan3d should updates the scene dragmode and dragmode button', function() {
                var buttonTurntable = selectButton(modeBar, 'tableRotation'),
                    buttonPan3d = selectButton(modeBar, 'pan3d');

                assertScenes(gd._fullLayout, 'dragmode', 'turntable');
                expect(buttonTurntable.isActive()).toBe(true);
                expect(buttonPan3d.isActive()).toBe(false);

                buttonPan3d.click();
                assertScenes(gd.layout, 'dragmode', 'pan');
                expect(gd.layout.dragmode).toBe(undefined);
                expect(gd._fullLayout.dragmode).toBe('zoom');
                expect(buttonTurntable.isActive()).toBe(false);
                expect(buttonPan3d.isActive()).toBe(true);

                buttonTurntable.click();
                assertScenes(gd._fullLayout, 'dragmode', 'turntable');
                expect(buttonTurntable.isActive()).toBe(true);
                expect(buttonPan3d.isActive()).toBe(false);
            });

            it('button orbitRotation should updates the scene dragmode and dragmode button', function() {
                var buttonTurntable = selectButton(modeBar, 'tableRotation'),
                    buttonOrbit = selectButton(modeBar, 'orbitRotation');

                assertScenes(gd._fullLayout, 'dragmode', 'turntable');
                expect(buttonTurntable.isActive()).toBe(true);
                expect(buttonOrbit.isActive()).toBe(false);

                buttonOrbit.click();
                assertScenes(gd.layout, 'dragmode', 'orbit');
                expect(gd.layout.dragmode).toBe(undefined);
                expect(gd._fullLayout.dragmode).toBe('zoom');
                expect(buttonTurntable.isActive()).toBe(false);
                expect(buttonOrbit.isActive()).toBe(true);

                buttonTurntable.click();
                assertScenes(gd._fullLayout, 'dragmode', 'turntable');
                expect(buttonTurntable.isActive()).toBe(true);
                expect(buttonOrbit.isActive()).toBe(false);
            });

            it('button hoverClosest3d should update the scene hovermode and spikes', function() {
                var buttonHover = selectButton(modeBar, 'hoverClosest3d');

                assertScenes(gd._fullLayout, 'hovermode', 'closest');
                expect(buttonHover.isActive()).toBe(true);

                buttonHover.click();
                assertScenes(gd._fullLayout, 'hovermode', false);
                assertScenes(gd._fullLayout, 'xaxis.showspikes', false);
                assertScenes(gd._fullLayout, 'yaxis.showspikes', false);
                assertScenes(gd._fullLayout, 'zaxis.showspikes', false);
                expect(buttonHover.isActive()).toBe(false);

                buttonHover.click();
                assertScenes(gd._fullLayout, 'hovermode', 'closest');
                assertScenes(gd._fullLayout, 'xaxis.showspikes', true);
                assertScenes(gd._fullLayout, 'yaxis.showspikes', true);
                assertScenes(gd._fullLayout, 'zaxis.showspikes', true);
                expect(buttonHover.isActive()).toBe(true);
            });

            it('button resetCameraDefault3d should reset camera to default', function(done) {
                var buttonDefault = selectButton(modeBar, 'resetCameraDefault3d');

                expect(gd._fullLayout.scene._scene.cameraInitial.eye).toEqual({ x: 0.1, y: 0.1, z: 1 });
                expect(gd._fullLayout.scene2._scene.cameraInitial.eye).toEqual({ x: 2.5, y: 2.5, z: 2.5 });

                gd.once('plotly_relayout', function() {
                    assertScenes(gd._fullLayout, 'camera.eye.x', 1.25);
                    assertScenes(gd._fullLayout, 'camera.eye.y', 1.25);
                    assertScenes(gd._fullLayout, 'camera.eye.z', 1.25);

                    expect(gd._fullLayout.scene._scene.getCamera().eye.z).toBeCloseTo(1.25);
                    expect(gd._fullLayout.scene2._scene.getCamera().eye.z).toBeCloseTo(1.25);

                    done();
                });

                buttonDefault.click();
            });

            it('button resetCameraLastSave3d should reset camera to default', function(done) {
                var buttonDefault = selectButton(modeBar, 'resetCameraDefault3d');
                var buttonLastSave = selectButton(modeBar, 'resetCameraLastSave3d');

                function assertCameraEye(sceneLayout, eyeX, eyeY, eyeZ) {
                    expect(sceneLayout.camera.eye.x).toEqual(eyeX);
                    expect(sceneLayout.camera.eye.y).toEqual(eyeY);
                    expect(sceneLayout.camera.eye.z).toEqual(eyeZ);

                    var camera = sceneLayout._scene.getCamera();
                    expect(camera.eye.x).toBeCloseTo(eyeX);
                    expect(camera.eye.y).toBeCloseTo(eyeY);
                    expect(camera.eye.z).toBeCloseTo(eyeZ);
                }

                Plotly.relayout(gd, {
                    'scene.camera.eye.z': 4,
                    'scene2.camera.eye.z': 5
                })
                .then(function() {
                    assertCameraEye(gd._fullLayout.scene, 0.1, 0.1, 4);
                    assertCameraEye(gd._fullLayout.scene2, 2.5, 2.5, 5);

                    return new Promise(function(resolve) {
                        gd.once('plotly_relayout', resolve);
                        buttonLastSave.click();
                    });
                })
                .then(function() {
                    assertCameraEye(gd._fullLayout.scene, 0.1, 0.1, 1);
                    assertCameraEye(gd._fullLayout.scene2, 2.5, 2.5, 2.5);

                    return new Promise(function(resolve) {
                        gd.once('plotly_relayout', resolve);
                        buttonDefault.click();
                    });
                })
                .then(function() {
                    assertCameraEye(gd._fullLayout.scene, 1.25, 1.25, 1.25);
                    assertCameraEye(gd._fullLayout.scene2, 1.25, 1.25, 1.25);

                    return new Promise(function(resolve) {
                        gd.once('plotly_relayout', resolve);
                        buttonLastSave.click();
                    });
                })
                .then(function() {
                    assertCameraEye(gd._fullLayout.scene, 0.1, 0.1, 1);
                    assertCameraEye(gd._fullLayout.scene2, 2.5, 2.5, 2.5);

                    delete gd._fullLayout.scene._scene.cameraInitial;
                    delete gd._fullLayout.scene2._scene.cameraInitial;

                    Plotly.relayout(gd, {
                        'scene.bgcolor': '#d3d3d3',
                        'scene.camera.eye.z': 4,
                        'scene2.camera.eye.z': 5
                    });
                })
                .then(function() {
                    assertCameraEye(gd._fullLayout.scene, 0.1, 0.1, 4);
                    assertCameraEye(gd._fullLayout.scene2, 2.5, 2.5, 5);

                    return new Promise(function(resolve) {
                        gd.once('plotly_relayout', resolve);
                        buttonDefault.click();
                    });
                })
                .then(function() {
                    assertCameraEye(gd._fullLayout.scene, 1.25, 1.25, 1.25);
                    assertCameraEye(gd._fullLayout.scene2, 1.25, 1.25, 1.25);

                    return new Promise(function(resolve) {
                        gd.once('plotly_relayout', resolve);
                        buttonLastSave.click();
                    });
                })
                .then(function() {
                    assertCameraEye(gd._fullLayout.scene, 0.1, 0.1, 4);
                    assertCameraEye(gd._fullLayout.scene2, 2.5, 2.5, 5);
                })
                .then(done);

            });
        });

        describe('drag and wheel interactions', function() {

            function scroll(target) {
                return new Promise(function(resolve) {
                    target.dispatchEvent(new WheelEvent('wheel', {deltaY: 1}));
                    setTimeout(resolve, 0);
                });
            }

            function drag(target) {
                return new Promise(function(resolve) {
                    target.dispatchEvent(new MouseEvent('mousedown', {x: 0, y: 0}));
                    target.dispatchEvent(new MouseEvent('mousemove', { x: 100, y: 100}));
                    target.dispatchEvent(new MouseEvent('mouseup', { x: 100, y: 100}));
                    setTimeout(resolve, 0);
                });
            }

            it('should update the scene camera', function(done) {
                var sceneLayout = gd._fullLayout.scene,
                    sceneLayout2 = gd._fullLayout.scene2,
                    sceneTarget = gd.querySelector('.svg-container .gl-container #scene  canvas'),
                    sceneTarget2 = gd.querySelector('.svg-container .gl-container #scene2 canvas');

                expect(sceneLayout.camera.eye)
                    .toEqual({x: 0.1, y: 0.1, z: 1});
                expect(sceneLayout2.camera.eye)
                    .toEqual({x: 2.5, y: 2.5, z: 2.5});

                scroll(sceneTarget).then(function() {
                    expect(relayoutCallback).toHaveBeenCalledTimes(1);
                    relayoutCallback.calls.reset();

                    return scroll(sceneTarget2);
                })
                .then(function() {
                    expect(relayoutCallback).toHaveBeenCalledTimes(1);
                    relayoutCallback.calls.reset();

                    return drag(sceneTarget2);
                })
                .then(function() {
                    expect(relayoutCallback).toHaveBeenCalledTimes(1);
                    relayoutCallback.calls.reset();

                    return drag(sceneTarget);
                })
                .then(function() {
                    expect(relayoutCallback).toHaveBeenCalledTimes(1);
                    relayoutCallback.calls.reset();

                    return Plotly.relayout(gd, {
                        'scene.dragmode': false,
                        'scene2.dragmode': false
                    });
                })
                .then(function() {
                    expect(relayoutCallback).toHaveBeenCalledTimes(1);
                    relayoutCallback.calls.reset();

                    return drag(sceneTarget);
                })
                .then(function() {
                    return drag(sceneTarget2);
                })
                .then(function() {
                    expect(relayoutCallback).toHaveBeenCalledTimes(0);

                    return Plotly.relayout(gd, {
                        'scene.dragmode': 'orbit',
                        'scene2.dragmode': 'turntable'
                    });
                })
                .then(function() {
                    expect(relayoutCallback).toHaveBeenCalledTimes(1);
                    relayoutCallback.calls.reset();

                    return drag(sceneTarget);
                })
                .then(function() {
                    return drag(sceneTarget2);
                })
                .then(function() {
                    expect(relayoutCallback).toHaveBeenCalledTimes(2);
                })
                .then(done);
            });
        });
    });

    describe('Removal of gl contexts', function() {

        var mockData2d = [{
            type: 'scattergl',
            x: [1, 2, 3],
            y: [2, 1, 3]
        }];


        var mockData3d = [{
            type: 'scatter3d',
            x: [1, 2, 3],
            y: [2, 1, 3],
            z: [3, 2, 1]
        }];

        describe('Plots.cleanPlot', function() {

            it('should remove gl context from the graph div of a gl3d plot', function(done) {
                gd = createGraphDiv();

                Plotly.plot(gd, mockData3d).then(function() {
                    expect(gd._fullLayout.scene._scene.glplot).toBeDefined();

                    Plots.cleanPlot([], {}, gd._fullData, gd._fullLayout);
                    expect(gd._fullLayout.scene._scene.glplot).toBe(null);

                    done();
                });
            });

            it('should remove gl context from the graph div of a gl2d plot', function(done) {
                gd = createGraphDiv();

                Plotly.plot(gd, mockData2d).then(function() {
                    expect(gd._fullLayout._plots.xy._scene2d.glplot).toBeDefined();

                    Plots.cleanPlot([], {}, gd._fullData, gd._fullLayout);
                    expect(gd._fullLayout._plots).toEqual({});

                    done();
                });
            });
        });

        describe('Plotly.newPlot', function() {

            var mockData2dNew = [{
                type: 'scattergl',
                x: [1, 3, 2],
                y: [2, 3, 1]
            }];


            var mockData3dNew = [{
                type: 'scatter3d',
                x: [2, 1, 3],
                y: [1, 2, 3],
                z: [2, 1, 3]
            }];


            it('should remove gl context from the graph div of a gl3d plot', function(done) {
                gd = createGraphDiv();

                Plotly.plot(gd, mockData3d).then(function() {

                    var firstGlplotObject = gd._fullLayout.scene._scene.glplot;
                    var firstGlContext = firstGlplotObject.gl;
                    var firstCanvas = firstGlContext.canvas;

                    expect(firstGlplotObject).toBeDefined();

                    Plotly.newPlot(gd, mockData3dNew, {}).then(function() {

                        var secondGlplotObject = gd._fullLayout.scene._scene.glplot;
                        var secondGlContext = secondGlplotObject.gl;
                        var secondCanvas = secondGlContext.canvas;

                        expect(secondGlplotObject).not.toBe(firstGlplotObject);
                        expect(firstGlplotObject.gl === null);
                        expect(secondGlContext instanceof WebGLRenderingContext);
                        expect(secondGlContext).not.toBe(firstGlContext);

                        // The same canvas can't possibly be reassinged a new WebGL context, but let's leave room
                        // for the implementation to make the context get lost and have the old canvas stick around
                        // in a disused state.
                        expect(firstCanvas.parentNode === null ||
                            firstCanvas !== secondCanvas && firstGlContext.isContextLost());

                        done();

                    });
                });
            });

            it('should remove gl context from the graph div of a gl2d plot', function(done) {
                gd = createGraphDiv();

                Plotly.plot(gd, mockData2d).then(function() {

                    var firstGlplotObject = gd._fullLayout._plots.xy._scene2d.glplot;
                    var firstGlContext = firstGlplotObject.gl;
                    var firstCanvas = firstGlContext.canvas;

                    expect(firstGlplotObject).toBeDefined();
                    expect(firstGlContext).toBeDefined();
                    expect(firstGlContext instanceof WebGLRenderingContext);

                    Plotly.newPlot(gd, mockData2dNew, {}).then(function() {

                        var secondGlplotObject = gd._fullLayout._plots.xy._scene2d.glplot;
                        var secondGlContext = secondGlplotObject.gl;
                        var secondCanvas = secondGlContext.canvas;

                        expect(Object.keys(gd._fullLayout._plots).length === 1);
                        expect(secondGlplotObject).not.toBe(firstGlplotObject);
                        expect(firstGlplotObject.gl === null);
                        expect(secondGlContext instanceof WebGLRenderingContext);
                        expect(secondGlContext).not.toBe(firstGlContext);
                        expect(firstCanvas.parentNode === null ||
                            firstCanvas !== secondCanvas && firstGlContext.isContextLost());

                        done();
                    });
                });
            });
        });
    });
});

describe('Test gl plot side effects', function() {
    var gd;

    beforeEach(function() {
        gd = createGraphDiv();
    });

    afterEach(destroyGraphDiv);

    describe('when present with rangeslider', function() {
        it('should not draw the rangeslider', function(done) {
            var data = [{
                x: [1, 2, 3],
                y: [2, 3, 4],
                type: 'scattergl'
            }, {
                x: [1, 2, 3],
                y: [2, 3, 4],
                type: 'scatter'
            }];

            var layout = {
                xaxis: { rangeslider: { visible: true } }
            };

            Plotly.plot(gd, data, layout).then(function() {
                var rangeSlider = document.getElementsByClassName('range-slider')[0];
                expect(rangeSlider).not.toBeDefined();
                done();
            });
        });
    });

    it('should be able to replot from a blank graph', function(done) {
        function countCanvases(cnt) {
            var nodes = d3.selectAll('canvas');
            expect(nodes.size()).toEqual(cnt);
        }

        var data = [{
            type: 'scattergl',
            x: [1, 2, 3],
            y: [2, 1, 2]
        }];

        Plotly.plot(gd, []).then(function() {
            countCanvases(0);

            return Plotly.plot(gd, data);
        }).then(function() {
            countCanvases(1);

            return Plotly.purge(gd);
        }).then(function() {
            countCanvases(0);

            return Plotly.plot(gd, data);
        }).then(function() {
            countCanvases(1);

            return Plotly.deleteTraces(gd, [0]);
        }).then(function() {
            countCanvases(0);

            return Plotly.purge(gd);
        }).then(done);
    });
});

describe('gl2d interaction', function() {
    var gd;

    beforeAll(function() {
        jasmine.addMatchers(customMatchers);
    });

    beforeEach(function() {
        gd = createGraphDiv();
    });

    afterEach(function() {
        Plotly.purge(gd);
        destroyGraphDiv();
    });

    it('data-referenced annotations should update on drag', function(done) {

        function drag(start, end) {
            mouseEvent('mousemove', start[0], start[1]);
            mouseEvent('mousedown', start[0], start[1], { buttons: 1 });
            mouseEvent('mousemove', end[0], end[1], { buttons: 1 });
            mouseEvent('mouseup', end[0], end[1]);
        }

        function assertAnnotation(xy) {
            var ann = d3.select('g.annotation-text-g').select('g');
            var translate = Drawing.getTranslate(ann);

            expect(translate.x).toBeWithin(xy[0], 1.5);
            expect(translate.y).toBeWithin(xy[1], 1.5);
        }

        Plotly.plot(gd, [{
            type: 'scattergl',
            x: [1, 2, 3],
            y: [2, 1, 2]
        }], {
            annotations: [{
                x: 2,
                y: 1,
                text: 'text'
            }],
            dragmode: 'pan'
        })
        .then(function() {
            assertAnnotation([327, 325]);

            drag([250, 200], [200, 150]);
            assertAnnotation([277, 275]);

            return Plotly.relayout(gd, {
                'xaxis.range': [1.5, 2.5],
                'yaxis.range': [1, 1.5]
            });
        })
        .then(function() {
            assertAnnotation([327, 331]);
        })
        .then(done);
    });
});

import { Container } from "../../src/container";
import { ContainerWindow, WindowEventType, WindowEventArgs, SnapAssistWindowManager, Rectangle } from "../../src/window";
import { EventArgs, EventEmitter } from "../../src/events";
import { TestContainer, MockMessageBus } from "./container.spec";

class MockWindow extends ContainerWindow {
}

describe ("static events", () => {
    let container: TestContainer;

    beforeEach(() => {
        container = new TestContainer();
        (<any>EventEmitter).staticEventListeners = new Map();
    });

    it("addListener adds callback to listeners", () => {
        expect(ContainerWindow.listeners("window-created").length).toEqual(0);
        ContainerWindow.addListener("window-created", (event: EventArgs) => { /* empty */ });
        expect(ContainerWindow.listeners("window-created").length).toEqual(1);
    });

    it("removeListener removes callback to listeners", () => {
        expect(ContainerWindow.listeners("window-created").length).toEqual(0);
        const callback = (event: EventArgs) => { /* empty */ };
        ContainerWindow.addListener("window-created", callback);
        expect(ContainerWindow.listeners("window-created").length).toEqual(1);
        ContainerWindow.removeListener("window-created", callback);
        expect(ContainerWindow.listeners("window-created").length).toEqual(0);
    });

    it("emit invokes ipc publish", () => {
        const args = new EventArgs(undefined, "window-created", {});
        spyOn(container.ipc, "publish").and.callThrough();
        ContainerWindow.emit(<WindowEventType> args.name, <WindowEventArgs> args);
        expect(container.ipc.publish).toHaveBeenCalledWith("desktopJS.static-event", { eventName: "containerwindow-" + args.name, eventArgs: args });
    });
});

describe("window grouping", () => {
    it("allowGrouping is false", () => {
        expect(new MockWindow(null).allowGrouping).toEqual(false);
    });

    it ("getGroup returns empty array", (done) => {
        new MockWindow(null).getGroup().then(windows => {
            expect(windows).toBeDefined();
            expect(windows.length).toEqual(0);
        }).then(done);
    });

    it ("joinGroup not supported", (done) => {
        new MockWindow(null).joinGroup(null).catch(reason => {
            expect(reason).toEqual("Not supported");
        }).then(done);
    });

    it ("leaveGroup resolves", (done) => {
        new MockWindow(null).leaveGroup().then(() => {
            done();
        });
    });
});

describe("Rectangle", () => {
    let r;
    beforeEach(() => {
        r = new Rectangle(1, 2, 3, 4);
    });

    it ("ctor sets properties", () => {
        expect(r.x).toEqual(1);
        expect(r.y).toEqual(2);
        expect(r.width).toEqual(3);
        expect(r.height).toEqual(4);
    });

    it ("right is calculated as x + width", () => {
        expect(r.right).toEqual(4);

        // check duck typing static method helper
        expect(Rectangle.getRight(<Rectangle> {x: 1, y: 2, width: 3, height: 4})).toEqual(4);
    });

    it ("bottom is calculated as top + height", () => {
        expect(r.bottom).toEqual(6);

         // check duck typing static method helper
        expect(Rectangle.getBottom(<Rectangle> {x: 1, y: 2, width: 3, height: 4})).toEqual(6);
    });
});

describe("SnapAssistWindowManager", () => {
    it ("default options", () => {
        const mgr = new SnapAssistWindowManager(null);
        expect(mgr.snapThreshold).toEqual(20);
        expect(mgr.snapOffset).toEqual(15);
        expect(mgr.autoGrouping).toEqual(true);
    });

    it ("overrides read from options", () => {
        const mgr = new SnapAssistWindowManager(null, { snapThreshold: 2, snapOffset: 3, autoGrouping: false });
        expect(mgr.snapThreshold).toEqual(2);
        expect(mgr.snapOffset).toEqual(3);
        expect(mgr.autoGrouping).toEqual(false);
    });

    it ("attach invoked on create", () => {
        const count = ContainerWindow.listeners("window-created").length;
        const mgr = new SnapAssistWindowManager(null);
        expect(ContainerWindow.listeners("window-created").length).toEqual(count + 1);
    });

    it ("attach enumerates all open windows and hooks handlers", () => {
        const container = jasmine.createSpyObj("container", [ "getAllWindows" ]);
        const win = jasmine.createSpyObj("window", [ "addListener"] );
        container.getAllWindows.and.returnValue(Promise.resolve([win]));
        const mgr = new SnapAssistWindowManager(container);
        //expect(win.addListener).toHaveBeenCalled();
    });

    it ("hook handlers on window attach", () => {
        const mgr = new SnapAssistWindowManager(null);
        const win = new MockWindow(null);
        spyOn(win, "addListener").and.stub();
        mgr.attach(win);
        expect(win.addListener).toHaveBeenCalled();
    });

    it ("onAttached sets OpenFin frameless api", () => {
        const win = jasmine.createSpyObj("window", ["addListener"]);
        const innerWin = jasmine.createSpyObj("innerwindow", ["disableFrame"]);
        Object.defineProperty(win, "innerWindow", { value: innerWin });
        const mgr = new SnapAssistWindowManager(null);
        mgr.onAttached(win);
        expect(innerWin.disableFrame).toHaveBeenCalled();
    });

    it ("onAttached hooks on Electron wndproc when available", () => {
        const win = jasmine.createSpyObj("window", ["addListener"]);
        const innerWin = jasmine.createSpyObj("innerwindow", ["hookWindowMessage"]);
        Object.defineProperty(win, "innerWindow", { value: innerWin });
        const mgr = new SnapAssistWindowManager(null);
        mgr.onAttached(win);
        expect(innerWin.hookWindowMessage).toHaveBeenCalledWith(0x0232, jasmine.any(Function));
    });

    it ("showGroupHint invokes underlying updateOptions when available", () => {
        const win = jasmine.createSpyObj("window", ["addListener"]);
        const innerWin = jasmine.createSpyObj("innerwindow", ["updateOptions"]);
        Object.defineProperty(win, "innerWindow", { value: innerWin });
        const mgr = new SnapAssistWindowManager(null);
        mgr.showGroupingHint(win);
        expect(innerWin.updateOptions).toHaveBeenCalledWith({opacity: 0.75});
    });

    it ("hideGroupHint invokes underlying updateOptions when available", () => {
        const win = jasmine.createSpyObj("window", ["addListener"]);
        const innerWin = jasmine.createSpyObj("innerwindow", ["updateOptions"]);
        Object.defineProperty(win, "innerWindow", { value: innerWin });
        const mgr = new SnapAssistWindowManager(null);
        mgr.hideGroupingHint(win);
        expect(innerWin.updateOptions).toHaveBeenCalledWith({opacity: 1.0});
    });

    it ("moveWindow sets stateful id and invokes setBounds", () => {
        const win = jasmine.createSpyObj("window", [ "setBounds" ]);
        win.setBounds.and.returnValue(Promise.resolve());
        Object.defineProperty(win, "id", { value: "5" });
        const mgr = new SnapAssistWindowManager(null);
        mgr.moveWindow(win, new Rectangle(0, 0, 0, 0));
        expect(mgr.snappingWindow).toEqual("5");
        expect(win.setBounds).toHaveBeenCalled();
    });

    it ("isHorizontallyAligned", () => {
        const mgr = new SnapAssistWindowManager(null);

        const r1 = new Rectangle(1, 100, 50, 50);

        const aligned: Rectangle[] = [
            new Rectangle(100, 100, 50, 50),
            new Rectangle(100, 101, 50, 50),
            new Rectangle(100, 125, 50, 50),
            new Rectangle(100, 150, 50, 50)
        ];

        for (const r of aligned) {
            expect((<any>mgr).isHorizontallyAligned(r1, r)).toEqual(true, r);
        }

        const notAligned: Rectangle[] = [
            new Rectangle(100, 1, 50, 50),
            new Rectangle(100, 200, 50, 50)
        ];

        for (const r of notAligned) {
            expect((<any>mgr).isHorizontallyAligned(r1, r)).toEqual(false, r);
        }
    });

    it ("isVerticallyAligned", () => {
        const mgr = new SnapAssistWindowManager(null);

        const r1 = new Rectangle(100, 100, 50, 50);

        const aligned: Rectangle[] = [
            new Rectangle(100, 0, 50, 50),
            new Rectangle(101, 0, 50, 50),
            new Rectangle(125, 0, 50, 50),
            new Rectangle(150, 0, 50, 50)
        ];

        for (const r of aligned) {
            expect((<any>mgr).isVerticallyAligned(r1, r)).toEqual(true, r);
        }

        const notAligned: Rectangle[] = [
            new Rectangle(0, 1, 50, 50),
            new Rectangle(200, 1, 50, 50)
        ];

        for (const r of notAligned) {
            expect((<any>mgr).isVerticallyAligned(r1, r)).toEqual(false, r);
        }
    });

    it ("move handler", (done) => {
        const win = jasmine.createSpyObj("window", ["addListener", "getGroup", "getBounds", "setBounds"]);
        Object.defineProperty(win, "id", { value: "1" });
        let callback;
        win.addListener.and.callFake((event, fn) => callback = fn);
        win.getGroup.and.returnValue(Promise.resolve([]));
        win.getBounds.and.returnValue(Promise.resolve(new Rectangle(0, 0, 50, 50)));
        win.setBounds.and.callFake(done);

        const win2 = jasmine.createSpyObj("targetWindow", ["addListener", "getBounds"]);
        Object.defineProperty(win2, "id", { value: "2" });
        win2.getBounds.and.returnValue(Promise.resolve(new Rectangle(52, 0, 50, 50)));

        const container = jasmine.createSpyObj("container", ["getAllWindows"]);
        container.getAllWindows.and.returnValue(Promise.resolve([ win, win2 ]));

        const mgr = new SnapAssistWindowManager(container);
        mgr.attach(win);
        callback(new WindowEventArgs(win, "move", undefined));
    });

    describe("getSnapBounds", () => {
        let mgr;

        beforeAll(() => {
            mgr = new SnapAssistWindowManager(null);
        });

        describe("left edge to right edge", () => {
            it ("within threshold", () => {
                const r1 = new Rectangle(52, 0, 50, 50);
                const r2 = new Rectangle(0, 0, 50, 50);
                expect((<any>mgr).getSnapBounds(r1, r2)).toEqual(new Rectangle(r2.right - mgr.snapOffset, 0, 50, 50));
            });

            it ("outside threshold", () => {
                const r1 = new Rectangle(55, 0, 50, 50);
                const r2 = new Rectangle(0, 0, 50, 50);
                expect((<any>mgr).getSnapBounds(r1, r2)).toEqual(undefined);
            });
        });

        describe("right edge to left edge", () => {
            it ("within threshold", () => {
                const r1 = new Rectangle(50, 0, 50, 50);
                const r2 = new Rectangle(100, 0, 50, 50);
                expect((<any>mgr).getSnapBounds(r1, r2)).toEqual(new Rectangle(r2.x - r1.width + mgr.snapOffset, 0, 50, 50));
            });

            it ("outside threshold", () => {
                const r1 = new Rectangle(40, 0, 50, 50);
                const r2 = new Rectangle(100, 0, 50, 50);
                expect((<any>mgr).getSnapBounds(r1, r2)).toEqual(undefined);
            });
        });

        describe("bottom edge to top edge", () => {
            it ("within threshold", () => {
                const r1 = new Rectangle(0, 50, 50, 50);
                const r2 = new Rectangle(0, 100, 50, 50);
                expect((<any>mgr).getSnapBounds(r1, r2)).toEqual(new Rectangle(0, r2.y - (r1.height - Math.floor(mgr.snapOffset / 2)), 50, 50));
            });

            it ("outside threshold", () => {
                const r1 = new Rectangle(0, 45, 50, 50);
                const r2 = new Rectangle(0, 100, 50, 50);
                expect((<any>mgr).getSnapBounds(r1, r2)).toEqual(undefined);
            });
        });

        describe("top edge to bottom edge", () => {
            it ("within threshold", () => {
                const r1 = new Rectangle(0, 100, 50, 50);
                const r2 = new Rectangle(0, 50, 50, 50);
                expect((<any>mgr).getSnapBounds(r1, r2)).toEqual(new Rectangle(0, r2.bottom - Math.floor(mgr.snapOffset / 2), 50, 50));
            });

            it ("outside threshold", () => {
                const r1 = new Rectangle(0, 110, 50, 50);
                const r2 = new Rectangle(0, 50, 50, 50);
                expect((<any>mgr).getSnapBounds(r1, r2)).toEqual(undefined);
            });
        });
    });
});
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Plane = void 0;
var typeorm_1 = require("typeorm");
var PlaneAlert_1 = require("../PlaneAlert");
var Plane = (function (_super) {
    __extends(Plane, _super);
    function Plane() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Plane.prototype.update = function () {
        var _a;
        (_a = PlaneAlert_1.PlaneAlert.trackSource) === null || _a === void 0 ? void 0 : _a.getPlaneStatus(this.icao);
    };
    __decorate([
        (0, typeorm_1.PrimaryGeneratedColumn)()
    ], Plane.prototype, "id", void 0);
    __decorate([
        (0, typeorm_1.Column)({ type: "varchar", length: 255 })
    ], Plane.prototype, "name", void 0);
    __decorate([
        (0, typeorm_1.Column)({ type: "varchar", length: 255 })
    ], Plane.prototype, "icao", void 0);
    __decorate([
        (0, typeorm_1.Column)({ type: "varchar", length: 255 })
    ], Plane.prototype, "registration", void 0);
    __decorate([
        (0, typeorm_1.Column)({ type: "boolean", default: true })
    ], Plane.prototype, "active", void 0);
    Plane = __decorate([
        (0, typeorm_1.Entity)()
    ], Plane);
    return Plane;
}(typeorm_1.BaseEntity));
exports.Plane = Plane;

import YAML from 'yaml'
import {PlaneAlert} from "../index";
import {FachaDevSource} from '../tracksources/facha-dev/FachaDevSource';
import * as fs from "fs";
import {GeoUtils} from "../utils/GeoUtils";
import {PlaneEvents} from "../enum/PlaneEvents";
import {EventUtils} from "../utils/EventUtils";
import {PlaneUtils} from "../utils/PlaneUtils";

export class Aircraft {

    public fileName: string;
    public name: string;
    public icao: string;
    public registration: string;
    public allowedAirports: string[];
    public refreshInterval: number;
    public callsign: string;

    ///
    public meta = {
        lastSeen: 0,
        onGround: false,
        liveTrack: false,
        squawk: "",
        lat: 0,
        lon: 0,
        alt: 0,
        emergency: false,
    }

    notifications = {
        includeScreenshots: false,
        discord: {
            enabled: false,
            webhooks: []
        },
        twitter: {
            enabled: false,
            accounts: [
                {
                    accessToken: '',
                    accessSecret: '',
                }
            ]
        }
    }


    constructor(file: string, fileName: string) {
        let aircraft = YAML.parse(file);
        this.fileName = fileName;
        this.name = aircraft.name;
        this.icao = aircraft.icao;
        this.registration = aircraft.registration;
        this.allowedAirports = aircraft.allowedAirports;
        this.refreshInterval = aircraft.refreshInterval;
        //
        this.meta.lastSeen = aircraft.meta.lastSeen;
        this.meta.onGround = aircraft.meta.onGround;
        this.meta.liveTrack = aircraft.meta.liveTrack;
        this.meta.lat = aircraft.meta.lat;
        this.meta.lon = aircraft.meta.lon;
        this.meta.alt = aircraft.meta.alt;
        //
        this.notifications = aircraft.notifications;
        this.callsign = aircraft.callsign;

        setTimeout(() => {
            if (this.registration === "" || this.registration === null) {
                PlaneAlert.log.warn("Plane " + this.name + " has no registration");
                FachaDevSource.getPlaneDetailsByIcao(this.icao).then(data => {
                    if (data?.registration) {
                        this.registration = <string>data?.registration;
                        PlaneAlert.log.info("Found REG: " + this.registration + " for " + this.name);
                        this.save();
                    }
                }).catch(err => {
                    PlaneAlert.log.warn("Failed getting registration for " + this.name + ": " + err);
                });
            }
            if (this.icao === "" || this.icao === null) {
                PlaneAlert.log.error("Plane " + this.name + " has no ICAO");
                throw new Error("Plane " + this.name + " has no ICAO");
            }
        }, 200);
    }

    private save() {
        PlaneAlert.log.debug("Saving aircraft " + this.name);
        fs.writeFileSync("./config/aircraft/" + this.fileName, YAML.stringify(this));
    }

    public async check() {
        PlaneAlert.log.info(`Checking aircraft ${this.name} (${this.icao})`);
        const data = await PlaneAlert.trackSource?.getPlaneStatus(this.icao);
        if (data === null) {
            // PlaneAlert.log.debug(`Plane ${this.name} (${this.icao}) returned no data`);
            if (!this.meta.onGround) {
                let triggerTime = new Date(this.meta.lastSeen);
                triggerTime.setMinutes(triggerTime.getMinutes() + PlaneAlert.config.thresholds.signalLoss);
                // PlaneAlert.log.debug(`Trigger time for ${this.icao} is ${triggerTime.toTimeString()}`);
                if (triggerTime < new Date()) {
                    PlaneAlert.log.info(`Plane ${this.name} (${this.icao}) has lost signal`);
                    const nearestAirport = GeoUtils.findNearestAirport(this);
                    if (nearestAirport !== null) {
                        PlaneAlert.log.debug(`Plane ${this.name} (${this.icao}) is near ${nearestAirport.airport.name} (${nearestAirport.airport.ident}) and has lost signal`);
                        if (this.meta.alt != null && this.meta.alt <= PlaneAlert.config.thresholds.landing) {
                            PlaneAlert.log.info(`Plane ${this.name} (${this.icao}) is at ${this.meta.alt} ft and has lost signal. Suspected landing`);
                            EventUtils.triggerEvent(PlaneEvents.PLANE_LAND, this, null, {nearestAirport: nearestAirport?.airport});
                            this.meta.onGround = true;
                        }
                    } else {
                        PlaneAlert.log.debug(`Plane ${this.name} (${this.icao}) has lost signal`);
                    }
                    EventUtils.triggerEvent(PlaneEvents.PLANE_LAND, this, null, {nearestAirport: nearestAirport?.airport});
                    this.meta.onGround = true;
                }
            }
            this.meta.liveTrack = false;
        } else {
            // set callsign
            this.callsign = data.callsign;

            //check time
            if (!data.onGround
                && data.barometricAltitude !== null
                && data.barometricAltitude < PlaneAlert.config.thresholds.takeoff
                && this.meta.onGround) {
                //Plane takeoff
                const nearestAirport = GeoUtils.findNearestAirport(this);
                if (nearestAirport !== null) {
                    PlaneAlert.log.info(`Plane ${this.name} (${this.icao}) took off at ${nearestAirport.airport.name} (${nearestAirport.airport.gps_code})`);
                    // Check altitude
                    // @ts-ignore
                    if (this.aircraft[i].meta.alt != null && this.aircraft[i].meta.alt <= PlaneAlert.config.thresholds.takeoff) {
                        EventUtils.triggerEvent(PlaneEvents.PLANE_TAKEOFF, this, null, {nearestAirport: nearestAirport?.airport});
                    }
                } else {
                    PlaneAlert.log.info(`Plane ${this.name} (${this.icao}) took off`);
                }
                EventUtils.triggerEvent(PlaneEvents.PLANE_TAKEOFF, this, null, {nearestAirport: nearestAirport?.airport});
            }
            if (data.onGround
                && data.barometricAltitude !== null
                && data.barometricAltitude < PlaneAlert.config.thresholds.landing
                && !this.meta.onGround) {
                PlaneAlert.log.info(`Plane ${this.icao} is landing`);
                //Plane landing
                const nearestAirport = GeoUtils.findNearestAirport(this);
                if (nearestAirport !== null) {
                    PlaneAlert.log.info(`Plane ${this.name} (${this.icao}) landed at ${nearestAirport.airport.name} (${nearestAirport.airport.icao})`);
                } else {
                    PlaneAlert.log.info(`Plane ${this.name} (${this.icao}) landed`);
                }
                EventUtils.triggerEvent(PlaneEvents.PLANE_LAND, this, null, {nearestAirport: nearestAirport?.airport});
            }
            PlaneAlert.log.info(`Plane ${this.name} (${this.icao}) is ${data.onGround ? "on ground" : "in the air"} at ${data.latitude}, ${data.longitude} with altitude ${data.barometricAltitude}`);

            this.meta.liveTrack = true;
            this.meta.lastSeen = new Date().getTime();
            this.meta.onGround = data.onGround;
            this.meta.lat = data.latitude;
            this.meta.lon = data.longitude;
            this.meta.alt = data.barometricAltitude;
            this.meta.squawk = data.squawk;
            this.meta.emergency = PlaneUtils.isEmergencySquawk(data.squawk);
        }

        this.save();
        // PlaneAlert.log.debug(`Plane ${this.name} (${this.icao}) returned data: ${JSON.stringify(data)}`);
    }


}

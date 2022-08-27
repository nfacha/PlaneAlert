import YAML from 'yaml'
import {PlaneAlert} from "../index";
import {FachaDevSource} from '../tracksources/facha-dev/FachaDevSource';
import * as fs from "fs";
import {GeoUtils} from "../utils/GeoUtils";
import {PlaneEvents} from "../enum/PlaneEvents";
import {EventUtils} from "../utils/EventUtils";

export interface AircraftMeta {
    icao: string;
    registration: string | null | undefined;
    callsign: string | null;
    meta: {
        squawk: number | null;
        lastSeen: number,
        onGround: boolean,
        liveTrack: boolean,
        lat: number | null,
        lon: number | null,
        alt: number | null,
        emergency: boolean,
    }
}

// Make a new type called webhook which is string[]
export interface Notifications {
    includeScreenshots: boolean,
    discord: {
        enabled: boolean,
        webhooks: string[],
    },
    twitter: {
        enabled: boolean,
        accounts: [
            {
                accessToken: string,
                accessSecret: string,
            }
        ]
    }
}
export class Airline {

    public fileName: string;
    public name: string;
    public icao: string;
    public allowedAirports: string[];
    public refreshInterval: number;

    ///
    public aircraft: AircraftMeta[] = [];

    public notifications: Notifications = {
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
        let airline = YAML.parse(file);
        this.fileName = fileName;
        this.name = airline.name;
        this.icao = airline.icao;
        this.allowedAirports = airline.allowedAirports;
        this.refreshInterval = airline.refreshInterval;
        //
        airline.aircraft.forEach((aircraft: AircraftMeta) => {
           this.aircraft.push({
                icao: aircraft.icao,
                registration: aircraft.registration,
                callsign: aircraft.callsign,
                meta: {
                    lastSeen: aircraft.meta.lastSeen,
                    onGround: aircraft.meta.onGround,
                    liveTrack: aircraft.meta.liveTrack,
                    lat: aircraft.meta.lat,
                    lon: aircraft.meta.lon,
                    alt: aircraft.meta.alt,
                    squawk: aircraft.meta.squawk,
                    emergency: false,
                }
           });
        });
        //
        this.notifications = airline.notifications;

        setTimeout(() => {
            this.aircraft.forEach((aircraft: AircraftMeta) => {
                if (aircraft.icao === "" || aircraft.icao === null) {
                    PlaneAlert.log.error("Plane " + this.name + " has no ICAO");
                    throw new Error("Plane " + this.name + " has no ICAO");
                }
                if (aircraft.registration === "" || aircraft.registration === null) {
                    PlaneAlert.log.warn("A plane has no registration");
                    FachaDevSource.getPlaneDetailsByIcao(aircraft.icao).then(data => {
                        if (data?.registration) {
                            aircraft.registration = <string>data?.registration;
                            PlaneAlert.log.info("Found REG: " + aircraft.registration + " for " + aircraft.icao);
                            this.save();
                        }
                    }).catch(err => {
                        PlaneAlert.log.warn("Failed getting registration for " + aircraft.icao + ": " + err);
                    });
                }
            })


        }, 200);
    }

    public save() {
        PlaneAlert.log.debug("Saving aircraft " + this.name);
        fs.writeFileSync("./config/airlines/" + this.fileName, YAML.stringify(this));
    }

    public async check() {
        PlaneAlert.log.debug("Checking airline " + this.name);
        const data = await FachaDevSource.getPlanesByOperator(this.icao);

        if (data === null) {
            PlaneAlert.log.warn("No data for " + this.name);
            return;
        }
        PlaneAlert.log.debug("Got " + data.length + " planes for " + this.name);
        for (let i = 0; i < data.length; i++) {
            // Check to see if this is a new plane
            const aircraft = this.aircraft.find(a => a.icao === data[i].icao24);
            if (aircraft === undefined) {
                PlaneAlert.log.debug("New plane " + data[i].icao24 + " for " + data[i].callsign);
                // Push new plane
                // I think this is really a bad way to do this. I am just too tired to figure out a better way.
                this.aircraft.push({
                    icao: data[i].icao24,
                    registration: data[i].registration,
                    callsign: data[i].callsign,
                    meta: {
                        alt: data[i].barometricAltitude,
                        lastSeen: Date.now(),
                        lat: data[i].latitude,
                        liveTrack: true,
                        lon: data[i].longitude,
                        onGround: data[i].onGround,
                        squawk: data[i].squawk,
                        emergency: false,
                    },
                });
            }
        }

        for (let i = 0; i < this.aircraft.length; i++) {
            PlaneAlert.log.info(`Checking aircraft ${this.name} (${this.aircraft[i].icao})`);
            const aircraft = data.find(a => a.icao24 === this.aircraft[i].icao);
            if (aircraft === undefined) {
                // PlaneAlert.log.debug(`Plane ${this.name} (${this.icao}) returned no data`);
                if (!this.aircraft[i].meta.onGround) {
                    let triggerTime = new Date(this.aircraft[i].meta.lastSeen);
                    triggerTime.setMinutes(triggerTime.getMinutes() + PlaneAlert.config.thresholds.signalLoss);
                    // PlaneAlert.log.debug(`Trigger time for ${this.icao} is ${triggerTime.toTimeString()}`);
                    if (triggerTime < new Date()) {
                        PlaneAlert.log.info(`Plane ${this.name} (${this.aircraft[i].icao}) has lost signal`);
                        const nearestAirport = GeoUtils.findNearestAirport(this.aircraft[i], this.allowedAirports);
                        if (nearestAirport !== null) {
                            PlaneAlert.log.debug(`Plane ${this.name} (${this.aircraft[i].icao}) is near ${nearestAirport.airport!.name!} (${nearestAirport.airport!.ident!}) and has lost signal`);
                            // Check altitude
                            // @ts-ignore
                            if (this.aircraft[i].meta.alt != null && this.aircraft[i].meta.alt <= PlaneAlert.config.thresholds.landing) {

                                PlaneAlert.log.info(`Plane ${this.name} (${this.aircraft[i].icao}) is at ${this.aircraft[i].meta.alt} ft and has lost signal. Suspected landing`);
                                EventUtils.triggerEvent(PlaneEvents.PLANE_LAND, this.aircraft[i], this, {nearestAirport: nearestAirport?.airport});
                                this.aircraft[i].meta.onGround = true;
                            }
                        } else {
                            PlaneAlert.log.debug(`Plane ${this.name} (${this.aircraft[i].icao}) has lost signal`);
                        }
                    }
                }
                this.aircraft[i].meta.liveTrack = false;
            } else {
                //check time
                if (!aircraft.onGround
                    && aircraft.barometricAltitude !== null
                    && aircraft.barometricAltitude < PlaneAlert.config.thresholds.takeoff
                    && this.aircraft[i].meta.onGround) {
                    //Plane takeoff
                    const nearestAirport = GeoUtils.findNearestAirport(this.aircraft[i], this.allowedAirports);
                    if (nearestAirport !== null) {
                        PlaneAlert.log.info(`Plane ${this.name} (${this.aircraft[i].icao}) took off at ${nearestAirport.airport.name} (${nearestAirport.airport.gps_code})`);
                        // Check altitude
                        // @ts-ignore
                        if (this.aircraft[i].meta.alt != null && this.aircraft[i].meta.alt <= PlaneAlert.config.thresholds.takeoff) {
                            EventUtils.triggerEvent(PlaneEvents.PLANE_TAKEOFF, this.aircraft[i], this, {nearestAirport: nearestAirport?.airport});
                        }
                    } else {
                        PlaneAlert.log.info(`Plane ${this.name} (${this.aircraft[i].icao}) took off`);
                    }
                }
                if (aircraft.onGround
                    && aircraft.barometricAltitude !== null
                    && aircraft.barometricAltitude < PlaneAlert.config.thresholds.landing
                    && !this.aircraft[i].meta.onGround) {
                    PlaneAlert.log.info(`Plane ${this.aircraft[i].icao} is landing`);
                    //Plane landing
                    const nearestAirport = GeoUtils.findNearestAirport(this.aircraft[i], this.allowedAirports);
                    if (nearestAirport !== null) {
                        PlaneAlert.log.info(`Plane ${this.name} (${this.aircraft[i].icao}) landed at ${nearestAirport.airport.name} (${nearestAirport.airport.icao})`);
                    } else {
                        PlaneAlert.log.info(`Plane ${this.name} (${this.aircraft[i].icao}) landed`);
                    }
                    EventUtils.triggerEvent(PlaneEvents.PLANE_LAND, this.aircraft[i], this, {nearestAirport: nearestAirport?.airport});
                }
                PlaneAlert.log.info(`Plane ${this.name} (${this.aircraft[i].icao}) is ${aircraft.onGround ? "on ground" : "in the air"} at ${aircraft.latitude}, ${aircraft.longitude} with altitude ${aircraft.barometricAltitude}`);

                this.aircraft[i].meta.liveTrack = true;
                this.aircraft[i].meta.lastSeen = new Date().getTime();
                this.aircraft[i].meta.onGround = aircraft.onGround;
                this.aircraft[i].meta.lat = aircraft.latitude;
                this.aircraft[i].meta.lon = aircraft.longitude;
                this.aircraft[i].meta.alt = aircraft.barometricAltitude;
                this.aircraft[i].meta.squawk = aircraft.squawk;
                this.aircraft[i].meta.emergency = false;
            }

            this.save();
            // PlaneAlert.log.debug(`Plane ${this.name} (${this.icao}) returned data: ${JSON.stringify(data)}`);
        }
    }

}

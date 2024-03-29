import YAML from 'yaml'
import {PlaneAlert} from "../index";
import {FachaDevSource} from '../tracksources/facha-dev/FachaDevSource';
import * as fs from "fs";
import {GeoUtils} from "../utils/GeoUtils";
import {PlaneEvents} from "../enum/PlaneEvents";
import {EventUtils} from "../utils/EventUtils";
import {PlaneUtils} from "../utils/PlaneUtils";

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
    },
    mastodon: {
        enabled: false,
        accounts: [
            {
                url: '',
                accessToken: '',
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
        },
        mastodon: {
            enabled: false,
            accounts: [
                {
                    url: '',
                    accessToken: '',
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
                    emergency: PlaneUtils.isEmergencySquawk(aircraft.meta.squawk),
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
        // Ensure that tracksource is not null or undefined
        if (!PlaneAlert.trackSource) {
            return;
        }

        const data = await PlaneAlert.trackSource.getPlanesByOperator(this.icao);

        if (data === null) {
            PlaneAlert.log.warn("No data for " + this.name);
            return;
        }
        PlaneAlert.log.debug("Got " + data.length + " planes for " + this.name);
        for (const element of data) {
            // Check to see if this is a new plane
            const aircraft = this.aircraft.find(a => a.icao === element.icao24);
            if (aircraft === undefined) {
                PlaneAlert.log.debug("New plane " + element.icao24 + " for " + element.callsign);
                // Push new plane
                // I think this is really a bad way to do this. I am just too tired to figure out a better way.
                this.aircraft.push({
                    icao: element.icao24,
                    registration: element.registration,
                    callsign: element.callsign,
                    meta: {
                        alt: element.barometricAltitude,
                        lastSeen: Date.now(),
                        lat: element.latitude,
                        liveTrack: true,
                        lon: element.longitude,
                        onGround: element.onGround,
                        squawk: element.squawk,
                        emergency: PlaneUtils.isEmergencySquawk(element.squawk),
                    },
                });
            }
        }

        for (const element of this.aircraft) {
            PlaneAlert.log.info(`Checking aircraft ${this.name} (${element.icao})`);
            const aircraft = data.find((a: { icao24: string; }) => a.icao24 === element.icao);
            if (aircraft === undefined) {
                // PlaneAlert.log.debug(`Plane ${this.name} (${this.icao}) returned no data`);
                if (!element.meta.onGround) {
                    let triggerTime = new Date(element.meta.lastSeen);
                    triggerTime.setMinutes(triggerTime.getMinutes() + PlaneAlert.config.thresholds.signalLoss);
                    // PlaneAlert.log.debug(`Trigger time for ${this.icao} is ${triggerTime.toTimeString()}`);
                    if (triggerTime < new Date()) {
                        PlaneAlert.log.info(`Plane ${this.name} (${element.icao}) has lost signal`);
                        const nearestAirport = GeoUtils.findNearestAirport(element, this.allowedAirports);
                        if (nearestAirport !== null) {
                            PlaneAlert.log.debug(`Plane ${this.name} (${element.icao}) is near ${nearestAirport.airport!.name!} (${nearestAirport.airport!.ident!}) and has lost signal`);
                            // Check altitude
                            if (element.meta.alt != null && element.meta.alt <= PlaneAlert.config.thresholds.landing) {

                                PlaneAlert.log.info(`Plane ${this.name} (${element.icao}) is at ${element.meta.alt} ft and has lost signal. Suspected landing`);
                                EventUtils.triggerEvent(PlaneEvents.PLANE_LAND, element, this, {nearestAirport: nearestAirport?.airport});
                                element.meta.onGround = true;
                            }
                        } else {
                            PlaneAlert.log.debug(`Plane ${this.name} (${element.icao}) has lost signal`);
                        }
                    }
                }
                element.meta.liveTrack = false;
            } else {
                //no emergency before, emergency now
                if (!element.meta.emergency && PlaneUtils.isEmergencySquawk(aircraft.squawk)) {
                    PlaneAlert.log.info(`Plane ${this.name} (${element.icao}) has emergency of type ${PlaneUtils.getEmergencyType(aircraft.squawk)}`);
                    EventUtils.triggerEvent(PlaneEvents.PLANE_EMERGENCY, element, this, {squawk: aircraft.squawk});
                }
                //check time
                if (!aircraft.onGround
                    && aircraft.barometricAltitude !== null
                    && aircraft.barometricAltitude < PlaneAlert.config.thresholds.takeoff
                    && element.meta.onGround) {
                    //Plane takeoff
                    const nearestAirport = GeoUtils.findNearestAirport(element, this.allowedAirports);
                    if (nearestAirport !== null) {
                        PlaneAlert.log.info(`Plane ${this.name} (${element.icao}) took off at ${nearestAirport.airport.name} (${nearestAirport.airport.gps_code})`);
                        // Check altitude
                        if (element.meta.alt != null && element.meta.alt <= PlaneAlert.config.thresholds.takeoff) {
                            EventUtils.triggerEvent(PlaneEvents.PLANE_TAKEOFF, element, this, {nearestAirport: nearestAirport?.airport});
                        }
                    } else {
                        PlaneAlert.log.info(`Plane ${this.name} (${element.icao}) took off`);
                    }
                }
                if (aircraft.onGround
                    && aircraft.barometricAltitude !== null
                    && aircraft.barometricAltitude < PlaneAlert.config.thresholds.landing
                    && !element.meta.onGround) {
                    PlaneAlert.log.info(`Plane ${element.icao} is landing`);
                    //Plane landing
                    const nearestAirport = GeoUtils.findNearestAirport(element, this.allowedAirports);
                    if (nearestAirport !== null) {
                        PlaneAlert.log.info(`Plane ${this.name} (${element.icao}) landed at ${nearestAirport.airport.name} (${nearestAirport.airport.icao})`);
                    } else {
                        PlaneAlert.log.info(`Plane ${this.name} (${element.icao}) landed`);
                    }
                    EventUtils.triggerEvent(PlaneEvents.PLANE_LAND, element, this, {nearestAirport: nearestAirport?.airport});
                }
                PlaneAlert.log.info(`Plane ${this.name} (${element.icao}) is ${aircraft.onGround ? "on ground" : "in the air"} at ${aircraft.latitude}, ${aircraft.longitude} with altitude ${aircraft.barometricAltitude}`);

                element.meta.liveTrack = true;
                element.meta.lastSeen = new Date().getTime();
                element.meta.onGround = aircraft.onGround;
                element.meta.lat = aircraft.latitude;
                element.meta.lon = aircraft.longitude;
                element.meta.alt = aircraft.barometricAltitude;
                element.meta.squawk = aircraft.squawk;
                element.meta.emergency = PlaneUtils.isEmergencySquawk(aircraft.squawk);
            }

            this.save();
            // PlaneAlert.log.debug(`Plane ${this.name} (${this.icao}) returned data: ${JSON.stringify(data)}`);
        }
    }

}

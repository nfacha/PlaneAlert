import YAML from 'yaml'
import {PlaneAlert} from "../index";
import {FachaDevSource} from '../tracksources/facha-dev/FachaDevSource';
import * as fs from "fs";
import {PlaneEvents} from "../enum/PlaneEvents";
import {EventUtils} from "../utils/EventUtils";
import {AircraftMeta, Notifications} from "./Airline";
import {PlaneUtils} from "../utils/PlaneUtils";


export class Squawk {

    public fileName: string;
    public name: string;
    public squawk: number;
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
        let type = YAML.parse(file);
        this.fileName = fileName;
        this.name = type.name;
        this.squawk = type.squawk;
        this.refreshInterval = type.refreshInterval;
        //
        type.aircraft.forEach((aircraft: AircraftMeta) => {
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
        this.notifications = type.notifications;

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
        fs.writeFileSync("./config/squawk/" + this.fileName, YAML.stringify(this));
    }

    public async check() {
        PlaneAlert.log.debug("Checking type " + this.name);
        const data = await PlaneAlert.trackSource.getPlanesBySquawk(this.squawk);

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
                const aircraft = {
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
                };
                //no emergency before, emergency now
                if (PlaneUtils.isEmergencySquawk(aircraft.meta.squawk)) {
                    PlaneAlert.log.info(`Plane ${this.name} (${aircraft.icao}) has emergency of type ${PlaneUtils.getEmergencyType(aircraft.meta.squawk)}`);
                    EventUtils.triggerEvent(PlaneEvents.PLANE_EMERGENCY, aircraft, this, {squawk: aircraft.meta.squawk});
                }
                // Push new plane
                // I think this is really a bad way to do this. I am just too tired to figure out a better way.
                this.aircraft.push(aircraft);
            }
        }

        for (const element of this.aircraft) {
            PlaneAlert.log.info(`Checking aircraft ${this.name} (${element.icao})`);
            const aircraft = data.find((a: { icao24: string; }) => a.icao24 === element.icao);
            if (aircraft !== undefined) {
                //no emergency before, emergency now
                if (!element.meta.emergency && PlaneUtils.isEmergencySquawk(aircraft.squawk)) {
                    PlaneAlert.log.info(`Plane ${this.name} (${element.icao}) has emergency of type ${PlaneUtils.getEmergencyType(aircraft.squawk)}`);
                    EventUtils.triggerEvent(PlaneEvents.PLANE_EMERGENCY, element, null, {squawk: aircraft.squawk});
                }
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

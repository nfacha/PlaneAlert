import YAML from 'yaml'
import {PlaneAlert} from "../index";
import {FachaDevSource} from '../tracksources/facha-dev/FachaDevSource';
import * as fs from "fs";
import {GeoUtils} from "../utils/GeoUtils";

export class Aircraft {

    public name: string;
    public icao: string;
    public registration: string;
    public allowedAirports: string[];
    public refreshInterval: number;

    ///
    private config = {
        lastSeen: 0,
        onGround: false,
        liveTrack: false,
        squawk: "",
        lat: 0,
        lon: 0,
        alt: 0
    }


    constructor(file: string) {
        let aircraft = YAML.parse(file);
        this.name = aircraft.name;
        this.icao = aircraft.icao;
        this.registration = aircraft.registration;
        this.allowedAirports = aircraft.allowedAirports;
        this.refreshInterval = aircraft.refreshInterval;
        this.config.lastSeen = aircraft.config.lastSeen;
        this.config.onGround = aircraft.config.onGround;
        this.config.liveTrack = aircraft.config.liveTrack;
        this.config.lat = aircraft.config.lat;
        this.config.lon = aircraft.config.lon;
        this.config.alt = aircraft.config.alt;

        setTimeout(() => {
            if (this.registration === "" || this.registration === null) {
                PlaneAlert.log.warn("Plane " + this.name + " has no registration");
                FachaDevSource.getPlaneDetailsByIcao(this.icao).then(data => {
                    if (data?.registration) {
                        this.registration = <string>data?.registration;
                        PlaneAlert.log.info("Found REG: " + this.registration + " for " + this.name);
                        this.save();
                    }
                });
            }
            if (this.icao === "" || this.icao === null) {
                PlaneAlert.log.error("Plane " + this.name + " has no ICAO");
                throw new Error("Plane " + this.name + " has no ICAO");
            }
        }, 200);
    }

    private save() {
        PlaneAlert.log.info("Saving aircraft " + this.name);
        fs.writeFileSync("./config/aircraft/" + this.icao + ".yaml", YAML.stringify(this));
    }

    public async check() {
        PlaneAlert.log.info(`Checking aircraft ${this.name} (${this.icao})`);
        const data = await PlaneAlert.trackSource?.getPlaneStatus(this.icao);
        if (data === null) {
            PlaneAlert.log.warn(`Plane ${this.name} (${this.icao}) returned no data`);
            if (!this.config.onGround) {
                let triggerTime = new Date();
                triggerTime.setMinutes(triggerTime.getMinutes() + PlaneAlert.config.thresholds.signalLoss);
                if (this.config.lastSeen < (new Date().getTime() - triggerTime.getTime())) {
                    PlaneAlert.log.warn(`Plane ${this.name} (${this.icao}) has lost signal`);
                    const nearestAirport = this.findNearestAirport();
                    if (nearestAirport !== null) {
                        PlaneAlert.log.warn(`Plane ${this.name} (${this.icao}) is near ${nearestAirport.airport.name} (${nearestAirport.airport.ident}) and has lost signal`);
                    } else {
                        PlaneAlert.log.warn(`Plane ${this.name} (${this.icao}) has lost signal`);
                    }
                }
            }
            this.config.liveTrack = false;
        } else {
            this.config.liveTrack = true;
            this.config.lastSeen = new Date().getTime();
            this.config.onGround = data.onGround;
            this.config.lat = data.latitude;
            this.config.lon = data.longitude;
            this.config.alt = data.barometricAltitude;
            this.config.squawk = data.squawk;

            //check time
            if (!data.onGround
                && data.barometricAltitude !== null
                && data.barometricAltitude < PlaneAlert.config.thresholds.takeoff
                && (!this.config.liveTrack || data.onGround)) {
                //Plane takeoff
                const nearestAirport = this.findNearestAirport();
                if (nearestAirport !== null) {
                    PlaneAlert.log.info(`Plane ${this.name} (${this.icao}) took off at ${nearestAirport.airport.name} (${nearestAirport.airport.icao})`);
                } else {
                    PlaneAlert.log.info(`Plane ${this.name} (${this.icao}) took off`);
                }
            }
            if (data.onGround
                && data.barometricAltitude !== null
                && data.barometricAltitude < PlaneAlert.config.thresholds.landing
                && !data.onGround) {
                PlaneAlert.log.info(`Plane ${this.icao} is landing`);
                //Plane landing
                const nearestAirport = this.findNearestAirport();
                if (nearestAirport !== null) {
                    PlaneAlert.log.info(`Plane ${this.name} (${this.icao}) landed at ${nearestAirport.airport.name} (${nearestAirport.airport.icao})`);
                } else {
                    PlaneAlert.log.info(`Plane ${this.name} (${this.icao}) landed`);
                }
            }
        }

        this.save();
        // PlaneAlert.log.debug(`Plane ${this.name} (${this.icao}) returned data: ${JSON.stringify(data)}`);
    }

    private findNearestAirport() {
        if (this.config.lon === null || this.config.lat === null || PlaneAlert.airports === null) {
            return null;
        }
        PlaneAlert.log.debug(`Plane ${this.name} (${this.icao}) searching for nearest airport of ${this.config.lat}/${this.config.lon}`);
        let min_distance = Number.MAX_SAFE_INTEGER;
        let nearest_airport = null;
        for (const airport of PlaneAlert.airports) {
            if (airport.type === 'closed') {
                continue;
            }
            if (this.allowedAirports.indexOf(airport.type) === -1) {
                continue;
            }
            const distance = GeoUtils.distanceBetweenCoordinates(this.config.lat, this.config.lon, airport.latitude_deg, airport.longitude_deg);
            if (distance < min_distance) {
                min_distance = distance;
                nearest_airport = airport;
            }
        }
        return {
            airport: nearest_airport,
            distance: min_distance
        };
    }
}

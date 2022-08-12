import YAML from 'yaml'
import {PlaneAlert} from "../index";
import {FachaDevSource} from '../tracksources/facha-dev/FachaDevSource';
import * as fs from "fs";

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
        if (data === undefined) {
            PlaneAlert.log.warn(`Plane ${this.name} (${this.icao}) returned no data`);
            return;
        }
        PlaneAlert.log.debug(`Plane ${this.name} (${this.icao}) returned data: ${JSON.stringify(data)}`);
    }
}

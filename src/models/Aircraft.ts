import YAML from 'yaml'
import {PlaneAlert} from "../index";

export class Aircraft {

    public name: string;
    public icao: string;
    public registration: string;
    public allowedAirports: string[];
    public refreshInterval: number;

    ///
    private lastSeen: number;
    private onGround: false;
    private liveTrack: boolean;
    private lat;
    private lon;
    private alt;


    constructor(file: string) {
        let aircraft = YAML.parse(file);
        this.name = aircraft.name;
        this.icao = aircraft.icao;
        this.registration = aircraft.registration;
        this.allowedAirports = aircraft.allowedAirports;
        this.refreshInterval = aircraft.refreshInterval;
        this.lastSeen = aircraft.config.lastSeen;
        this.onGround = aircraft.config.onGround;
        this.liveTrack = aircraft.config.liveTrack;
        this.lat = aircraft.config.lat;
        this.lon = aircraft.config.lon;
        this.alt = aircraft.config.alt;

        setTimeout(() => {
            if (this.registration === "" || this.registration === null) {
                PlaneAlert.log.warn("Plane " + this.name + " has no registration");
            }
            if (this.icao === "" || this.icao === null) {
                PlaneAlert.log.error("Plane " + this.name + " has no ICAO");
                throw new Error("Plane " + this.name + " has no ICAO");
            }
        }, 2500);
    }
}

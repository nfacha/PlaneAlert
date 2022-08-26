import YAML from 'yaml'
import {PlaneAlert} from "../index";
import {FachaDevSource} from '../tracksources/facha-dev/FachaDevSource';
import * as fs from "fs";
import {GeoUtils} from "../utils/GeoUtils";
import {PlaneEvents} from "../enum/PlaneEvents";
import TwitterUtils from "../utils/TwitterUtils";
import {Common} from "../utils/common";
import {WebhookClient} from "discord.js";
import {PlaneSpotterUtils} from "../utils/PlaneSpotterUtils";

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

    private notifications: Notifications = {
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
                        const nearestAirport = this.findNearestAirport(this.aircraft[i]);
                        if (nearestAirport !== null) {
                            PlaneAlert.log.debug(`Plane ${this.name} (${this.aircraft[i].icao}) is near ${nearestAirport.airport.name} (${nearestAirport.airport.ident}) and has lost signal`);
                        } else {
                            PlaneAlert.log.debug(`Plane ${this.name} (${this.aircraft[i].icao}) has lost signal`);
                        }
                        this.triggerEvent(PlaneEvents.PLANE_LAND, {nearestAirport: nearestAirport?.airport}, this.aircraft[i]);
                        this.aircraft[i].meta.onGround = true;
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
                    const nearestAirport = this.findNearestAirport(this.aircraft[i]);
                    if (nearestAirport !== null) {
                        PlaneAlert.log.info(`Plane ${this.name} (${this.aircraft[i].icao}) took off at ${nearestAirport.airport.name} (${nearestAirport.airport.gps_code})`);
                    } else {
                        PlaneAlert.log.info(`Plane ${this.name} (${this.aircraft[i].icao}) took off`);
                    }
                    this.triggerEvent(PlaneEvents.PLANE_TAKEOFF, {nearestAirport: nearestAirport?.airport}, this.aircraft[i]);
                }
                if (aircraft.onGround
                    && aircraft.barometricAltitude !== null
                    && aircraft.barometricAltitude < PlaneAlert.config.thresholds.landing
                    && !this.aircraft[i].meta.onGround) {
                    PlaneAlert.log.info(`Plane ${this.aircraft[i].icao} is landing`);
                    //Plane landing
                    const nearestAirport = this.findNearestAirport(this.aircraft[i]);
                    if (nearestAirport !== null) {
                        PlaneAlert.log.info(`Plane ${this.name} (${this.aircraft[i].icao}) landed at ${nearestAirport.airport.name} (${nearestAirport.airport.icao})`);
                    } else {
                        PlaneAlert.log.info(`Plane ${this.name} (${this.aircraft[i].icao}) landed`);
                    }
                    this.triggerEvent(PlaneEvents.PLANE_LAND, {nearestAirport: nearestAirport?.airport}, this.aircraft[i]);
                }
                PlaneAlert.log.info(`Plane ${this.name} (${this.aircraft[i].icao}) is ${aircraft.onGround ? "on ground" : "in the air"} at ${aircraft.latitude}, ${aircraft.longitude} with altitude ${aircraft.barometricAltitude}`);

                this.aircraft[i].meta.liveTrack = true;
                this.aircraft[i].meta.lastSeen = new Date().getTime();
                this.aircraft[i].meta.onGround = aircraft.onGround;
                this.aircraft[i].meta.lat = aircraft.latitude;
                this.aircraft[i].meta.lon = aircraft.longitude;
                this.aircraft[i].meta.alt = aircraft.barometricAltitude;
                this.aircraft[i].meta.squawk = aircraft.squawk;
            }

            this.save();
            // PlaneAlert.log.debug(`Plane ${this.name} (${this.icao}) returned data: ${JSON.stringify(data)}`);
        }
    }

    private findNearestAirport(aircraft: AircraftMeta) {
        if (aircraft.meta.lon === null || aircraft.meta.lat === null || PlaneAlert.airports === null) {
            return null;
        }
        PlaneAlert.log.debug(`Plane ${this.name} (${aircraft.icao}) searching for nearest airport of ${aircraft.meta.lat}/${aircraft.meta.lon}`);
        let min_distance = Number.MAX_SAFE_INTEGER;
        let nearest_airport = null;
        for (const airport of PlaneAlert.airports) {
            if (airport.type === 'closed') {
                continue;
            }
            if (this.allowedAirports.indexOf(airport.type) === -1) {
                continue;
            }
            const distance = GeoUtils.distanceBetweenCoordinates(aircraft.meta.lat, aircraft.meta.lon, airport.latitude_deg, airport.longitude_deg);
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

    private async triggerEvent(event: PlaneEvents, data: any = null, aircraft: AircraftMeta) {
        const adsbExchangeLink = 'https://globe.adsbexchange.com/?icao=' + aircraft.icao;
        let photoUrl = await PlaneSpotterUtils.getPhotoUrl(aircraft.icao);
        return new Promise(async (resolve, reject) => {
            PlaneAlert.log.info(`Plane ${this.name} (${aircraft.icao}) triggered  ${event}`);
            switch (event) {
                case PlaneEvents.PLANE_TAKEOFF:
                    let hasTakeoffScreenshot = false;
                    if(this.notifications.includeScreenshots){
                        hasTakeoffScreenshot = await Common.takeScreenshot(aircraft.icao);
                    }
                    if (this.notifications.discord.enabled) {
                        let message = `**${this.name}** flight ${aircraft.callsign} (${aircraft.registration}) took off from **${data.nearestAirport.name}** at <t:${(new Date().getTime() / 1000).toFixed(0)}:t>\n${adsbExchangeLink}`;

                        for (const discord of this.notifications.discord.webhooks) {
                            const hook = new WebhookClient({url: discord});
                            PlaneAlert.log.debug(`Plane ${this.name} (${aircraft.icao}) sending discord notification to ${discord}`);
                            if (hasTakeoffScreenshot) {
                                // Get RawFile of `/tmp/${aircraft.icao}.png`
                                const rawFile = await fs.readFileSync(`/tmp/${aircraft.icao}.png`);
                                await hook.send({
                                    username: this.name + ' - ' + aircraft.registration,
                                    avatarURL: photoUrl ? photoUrl : null,
                                    content: message,
                                    files: [rawFile]
                                });
                            }

                        }
                    }
                    if (this.notifications.twitter.enabled) {
                        for(const account of this.notifications.twitter.accounts) {
                            const client = TwitterUtils.getTwitterClient(account.accessToken, account.accessSecret);
                            let mediaId = '';
                            if(hasTakeoffScreenshot){
                                mediaId = await client.v1.uploadMedia(`/tmp/${aircraft.icao}.png`);
                            }
                            await client.v2.tweet({
                                text: `${this.name} (${aircraft.callsign}) (#${aircraft.registration}) took off from ${data.nearestAirport.name} at ${new Date().toLocaleString()}\n${adsbExchangeLink}`,
                                media: hasTakeoffScreenshot ? {media_ids: [mediaId]} : undefined
                            })
                        }
                    }
                    resolve(true);
                    break;
                case PlaneEvents.PLANE_LAND:
                    let hasLandingScreenshot = false;
                    if(this.notifications.includeScreenshots){
                        hasLandingScreenshot = await Common.takeScreenshot(aircraft.icao);
                    }
                    if (this.notifications.discord.enabled) {
                        let message = `**${this.name}** flight ${aircraft.callsign} (${aircraft.registration}) landed at **${data.nearestAirport.name}** at <t:${(new Date().getTime() / 1000).toFixed(0)}:t>\n${adsbExchangeLink}`;

                        for (const discord of this.notifications.discord.webhooks) {
                            const hook = new WebhookClient({url: discord});
                            PlaneAlert.log.debug(`Plane ${this.name} (${aircraft.icao}) sending discord notification to ${discord}`);
                            if (hasLandingScreenshot) {
                                // Get RawFile of `/tmp/${aircraft.icao}.png`
                                const rawFile = await fs.readFileSync(`/tmp/${aircraft.icao}.png`);
                                await hook.send({
                                    username: this.name + ' - ' + aircraft.registration,
                                    avatarURL: photoUrl ?  photoUrl : null,
                                    content: message,
                                    files: [rawFile]
                                });
                            }

                        }
                    }
                    if (this.notifications.twitter.enabled) {
                        for(const account of this.notifications.twitter.accounts) {
                            const client = TwitterUtils.getTwitterClient(account.accessToken, account.accessSecret);
                            let mediaId = '';
                            if(hasLandingScreenshot){
                                mediaId = await client.v1.uploadMedia(`/tmp/${aircraft.icao}.png`);
                            }
                            await client.v2.tweet({
                                text: `${this.name} (${aircraft.callsign}) (#${aircraft.registration}) landed at ${data.nearestAirport.name} at ${new Date().toLocaleString()}\n${adsbExchangeLink}`,
                                media: hasLandingScreenshot ? {media_ids: [mediaId]} : undefined
                            })
                        }
                    }
                    resolve(true);
                    break;
            }
        });
    }

}

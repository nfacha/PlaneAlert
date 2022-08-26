import YAML from 'yaml'
import {PlaneAlert} from "../index";
import {FachaDevSource} from '../tracksources/facha-dev/FachaDevSource';
import * as fs from "fs";
import {GeoUtils} from "../utils/GeoUtils";
import {PlaneEvents} from "../enum/PlaneEvents";
import axios from "axios";
import TwitterUtils from "../utils/TwitterUtils";
import {Common} from "../utils/common";
import {WebhookClient} from "discord.js";

export class Aircraft {

    public fileName: string;
    public name: string;
    public icao: string;
    public registration: string;
    public allowedAirports: string[];
    public refreshInterval: number;
    public callsign: string;

    ///
    private meta = {
        lastSeen: 0,
        onGround: false,
        liveTrack: false,
        squawk: "",
        lat: 0,
        lon: 0,
        alt: 0
    }

    private notifications = {
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
                    const nearestAirport = this.findNearestAirport();
                    if (nearestAirport !== null) {
                        PlaneAlert.log.debug(`Plane ${this.name} (${this.icao}) is near ${nearestAirport.airport.name} (${nearestAirport.airport.ident}) and has lost signal`);
                    } else {
                        PlaneAlert.log.debug(`Plane ${this.name} (${this.icao}) has lost signal`);
                    }
                    this.triggerEvent(PlaneEvents.PLANE_LAND, {nearestAirport: nearestAirport?.airport});
                    this.meta.onGround = true;
                }
            }
            this.meta.liveTrack = false;
        } else {
            // set callsign
            data.callsign = this.callsign;

            //check time
            if (!data.onGround
                && data.barometricAltitude !== null
                && data.barometricAltitude < PlaneAlert.config.thresholds.takeoff
                && this.meta.onGround) {
                //Plane takeoff
                const nearestAirport = this.findNearestAirport();
                if (nearestAirport !== null) {
                    PlaneAlert.log.info(`Plane ${this.name} (${this.icao}) took off at ${nearestAirport.airport.name} (${nearestAirport.airport.gps_code})`);
                } else {
                    PlaneAlert.log.info(`Plane ${this.name} (${this.icao}) took off`);
                }
                this.triggerEvent(PlaneEvents.PLANE_TAKEOFF, {nearestAirport: nearestAirport?.airport});
            }
            if (data.onGround
                && data.barometricAltitude !== null
                && data.barometricAltitude < PlaneAlert.config.thresholds.landing
                && !this.meta.onGround) {
                PlaneAlert.log.info(`Plane ${this.icao} is landing`);
                //Plane landing
                const nearestAirport = this.findNearestAirport();
                if (nearestAirport !== null) {
                    PlaneAlert.log.info(`Plane ${this.name} (${this.icao}) landed at ${nearestAirport.airport.name} (${nearestAirport.airport.icao})`);
                } else {
                    PlaneAlert.log.info(`Plane ${this.name} (${this.icao}) landed`);
                }
                this.triggerEvent(PlaneEvents.PLANE_LAND, {nearestAirport: nearestAirport?.airport});
            }
            PlaneAlert.log.info(`Plane ${this.name} (${this.icao}) is ${data.onGround ? "on ground" : "in the air"} at ${data.latitude}, ${data.longitude} with altitude ${data.barometricAltitude}`);

            this.meta.liveTrack = true;
            this.meta.lastSeen = new Date().getTime();
            this.meta.onGround = data.onGround;
            this.meta.lat = data.latitude;
            this.meta.lon = data.longitude;
            this.meta.alt = data.barometricAltitude;
            this.meta.squawk = data.squawk;
        }

        this.save();
        // PlaneAlert.log.debug(`Plane ${this.name} (${this.icao}) returned data: ${JSON.stringify(data)}`);
    }

    private findNearestAirport() {
        if (this.meta.lon === null || this.meta.lat === null || PlaneAlert.airports === null) {
            return null;
        }
        PlaneAlert.log.debug(`Plane ${this.name} (${this.icao}) searching for nearest airport of ${this.meta.lat}/${this.meta.lon}`);
        let min_distance = Number.MAX_SAFE_INTEGER;
        let nearest_airport = null;
        for (const airport of PlaneAlert.airports) {
            if (airport.type === 'closed') {
                continue;
            }
            if (this.allowedAirports.indexOf(airport.type) === -1) {
                continue;
            }
            const distance = GeoUtils.distanceBetweenCoordinates(this.meta.lat, this.meta.lon, airport.latitude_deg, airport.longitude_deg);
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

    private async triggerEvent(event: PlaneEvents, data: any = null) {
        const adsbExchangeLink = 'https://globe.adsbexchange.com/?icao=' + this.icao;
        let photoUrl = await this.getPhotoUrl()
        return new Promise(async (resolve, reject) => {
            PlaneAlert.log.info(`Plane ${this.name} (${this.icao}) triggered  ${event}`);
            switch (event) {
                case PlaneEvents.PLANE_TAKEOFF:
                    let hasTakeoffScreenshot = false;
                    if(this.notifications.includeScreenshots){
                        hasTakeoffScreenshot = await Common.takeScreenshot(this.icao);
                    }
                    if (this.notifications.discord.enabled) {
                        let message = `**${this.name}** flight ${this.callsign} (${this.registration}) took off from **${data.nearestAirport.name}** at <t:${(new Date().getTime() / 1000).toFixed(0)}:t>\n${adsbExchangeLink}`;

                        for (const discord of this.notifications.discord.webhooks) {
                            const hook = new WebhookClient({url: discord});
                            PlaneAlert.log.debug(`Plane ${this.name} (${this.icao}) sending discord notification to ${discord}`);
                            if (hasTakeoffScreenshot) {
                                // Get RawFile of `/tmp/${aircraft.icao}.png`
                                const rawFile = await fs.readFileSync(`/tmp/${this.icao}.png`);
                                await hook.send({
                                    username: this.name + ' - ' + this.registration,
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
                                mediaId = await client.v1.uploadMedia(`/tmp/${this.icao}.png`);
                            }
                            await client.v2.tweet({
                                text: `${this.name} (${this.callsign}) (#${this.registration}) took off from ${data.nearestAirport.name} at ${new Date().toLocaleString()}\n${adsbExchangeLink}`,
                                media: hasTakeoffScreenshot ? {media_ids: [mediaId]} : undefined
                            })
                        }
                    }
                    resolve(true);
                    break;
                case PlaneEvents.PLANE_LAND:

                    resolve(true);
                    break;
            }
        });
    }

    private async getPhotoUrl() {
        let photoUrl = null;
        if (this.icao !== null) {
            const photoData = await axios.get('https://api.planespotters.net/pub/photos/hex/' + this.icao);
            if (photoData.status === 200 && photoData.data.photos.length > 0) {
                photoUrl = photoData.data.photos[0].thumbnail_large.src
            }
        }
        return photoUrl;
    }
}

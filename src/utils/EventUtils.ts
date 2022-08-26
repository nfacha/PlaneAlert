import {PlaneEvents} from "../enum/PlaneEvents";
import {PlaneSpotterUtils} from "./PlaneSpotterUtils";
import {PlaneAlert} from "../index";
import {ScreenshotUtils} from "./ScreenshotUtils";
import {WebhookClient} from "discord.js";
import fs from "fs";
import TwitterUtils from "./TwitterUtils";
import {Aircraft} from "../models/Aircraft";
import {AircraftMeta, Airline} from "../models/Airline";

export class EventUtils {
    public static async triggerEvent(event: PlaneEvents, aircraft: Aircraft | AircraftMeta, airline: Airline | null = null, data: any = null) {
        const adsbExchangeLink = 'https://globe.adsbexchange.com/?icao=' + aircraft.icao;
        let photoUrl = await PlaneSpotterUtils.getPhotoUrl(aircraft.icao);
        const notificationSettings = aircraft instanceof Aircraft ? aircraft.notifications : airline!.notifications;
        const notificationName = aircraft instanceof Aircraft ? aircraft.name : aircraft.icao;
        return new Promise(async (resolve, reject) => {
            PlaneAlert.log.info(`Plane ${notificationName} (${aircraft.icao}) triggered  ${event}`);
            switch (event) {
                case PlaneEvents.PLANE_TAKEOFF:
                    let hasTakeoffScreenshot = false;
                    if (notificationSettings.includeScreenshots) {
                        hasTakeoffScreenshot = await ScreenshotUtils.takeScreenshot(aircraft.icao);
                    }
                    if (notificationSettings.discord.enabled) {
                        let message = `**${notificationName}** flight ${aircraft.callsign} (${aircraft.registration}) took off from **${data.nearestAirport.name}** at <t:${(new Date().getTime() / 1000).toFixed(0)}:t>\n${adsbExchangeLink}`;

                        for (const discord of notificationSettings.discord.webhooks) {
                            const hook = new WebhookClient({url: discord});
                            PlaneAlert.log.debug(`Plane ${notificationName} (${aircraft.icao}) sending discord notification to ${discord}`);
                            if (hasTakeoffScreenshot) {
                                // Get RawFile of `/tmp/${aircraft.icao}.png`
                                const rawFile = await fs.readFileSync(`/tmp/${aircraft.icao}.png`);
                                await hook.send({
                                    username: notificationName + ' - ' + aircraft.registration,
                                    avatarURL: photoUrl ? photoUrl : undefined,
                                    content: message,
                                    files: [rawFile]
                                });
                            }

                        }
                    }
                    if (notificationSettings.twitter.enabled) {
                        for (const account of notificationSettings.twitter.accounts) {
                            const client = TwitterUtils.getTwitterClient(account.accessToken, account.accessSecret);
                            let mediaId = '';
                            if (hasTakeoffScreenshot) {
                                mediaId = await client.v1.uploadMedia(`/tmp/${aircraft.icao}.png`);
                            }
                            await client.v2.tweet({
                                text: `${notificationName} (${aircraft.callsign}) (#${aircraft.registration}) took off from ${data.nearestAirport.name} at ${new Date().toLocaleString()}\n${adsbExchangeLink}`,
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

}

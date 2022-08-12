import {BaseEntity, Column, Entity, IsNull, OneToMany, PrimaryGeneratedColumn} from "typeorm";
import {PlaneAlert} from "../index";
import {PlaneEvents} from "../enum/PlaneEvents";
import {GeoUtils} from "../utils/GeoUtils";
import {Flight} from "./Flight";
import {Webhook} from "discord-webhook-node";
import axios from "axios";
import {TwitterAssignment} from "./TwitterAssignment";
import {DiscordAssignment} from "./DiscordAssignment";
import {TrackHistory} from "./TrackHistory";

@Entity()
export class Plane extends BaseEntity {

    @PrimaryGeneratedColumn()
    id!: number;

    @Column({type: "varchar", length: 255})
    name!: string;

    @Column({type: "varchar", length: 255, nullable: true})
    icao!: string;

    @Column({type: "varchar", length: 255, nullable: true})
    registration!: string;

    @Column({type: "boolean", default: true})
    active!: boolean;

    @Column({type: "varchar", length: 255, default: "large_airport,medium_airport,small_airport"})
    allowed_airports!: string;

    @Column({type: "integer", default: 1800})
    refresh_interval!: number;

    @Column({type: "timestamp", nullable: true})
    last_refresh!: Date;

    @Column({type: "timestamp", nullable: true})
    next_refresh!: Date;

    @Column({type: "timestamp", nullable: true})
    last_seen!: Date;

    @Column({type: "boolean", default: true})
    on_ground!: boolean;

    @Column({type: "boolean", default: false})
    live_track!: boolean;

    @Column({type: "integer", nullable: true})
    last_lat!: number | null;

    @Column({type: "integer", nullable: true})
    last_lng!: number | null;

    @Column({type: "integer", nullable: true})
    last_altitude!: number | null;

    @OneToMany(() => TwitterAssignment, account => account.plane)
    twitterAccountAssignments!: TwitterAssignment[];

    @OneToMany(() => DiscordAssignment, account => account.plane)
    discordAccountAssignments!: DiscordAssignment[];

    ////////////////////////////////////////////////////////////////

    public async update() {
        let planeQuery = this.icao;
        // if (PlaneAlert.config['trackSource'] === TrackSource.FLIGHT_RADAR_24) {
        //     planeQuery = this.registration;
        // }
        const data = await PlaneAlert.trackSource?.getPlaneStatus(planeQuery);
        if (data === undefined) {
            return;
        }
        // PlaneAlert.log.info(data);
        if (data !== null) {
            const history = new TrackHistory();
            history.plane_id = this.id;
            history.timestamp = new Date();
            if (data.latitude !== null && data.longitude !== null) {
                this.last_lat = Math.round(data.latitude * 1E6);
                this.last_lng = Math.round(data.longitude * 1E6);
                history.latitude = data.latitude;
                history.longitude = data.longitude;
            } else {
                this.last_lat = null;
                this.last_lng = null;
            }
            if (data.barometricAltitude !== null) {
                this.last_altitude = Math.round(data.barometricAltitude);
                history.barometricAltitude = this.last_altitude;
            } else {
                this.last_altitude = null;
            }
            history.onGround = data.onGround;
            if (data.callsign !== null) {
                history.callsign = data.callsign;
            }
            if (data.velocity !== null) {
                history.velocity = data.velocity;
            }
            if (data.verticalRate !== null) {
                history.verticalRate = data.verticalRate;
            }
            if (data.squawk !== null) {
                history.squawk = data.squawk;
            }
            if (!data.onGround
                && data.barometricAltitude !== null && data.barometricAltitude < PlaneAlert.config['takeoffAltitudeThreshold']
                && (!this.live_track || data.onGround)) {
                //Plane takeoff
                const nearestAirport = this.findNearestAirport();
                const flight = new Flight();
                flight.plane_id = this.id;
                flight.departure_time = new Date();
                flight.callsign = data.callsign;
                flight.squawk = data.squawk;
                if (nearestAirport?.airport !== null) {
                    PlaneAlert.log.info(`Plane ${this.icao} is taking off from ${nearestAirport?.airport.name}`);
                    flight.departure_airport = nearestAirport?.airport.ident;
                } else {
                    PlaneAlert.log.info(`Plane ${this.icao} is taking off`);
                }
                flight.save();
                this.triggerEvent(PlaneEvents.PLANE_TAKEOFF, flight, {nearestAirport: nearestAirport?.airport});
            }
            if (data.onGround
                && data.barometricAltitude !== null
                && data.barometricAltitude < PlaneAlert.config['landingAltitudeThreshold']
                && !this.on_ground) {
                PlaneAlert.log.info(`Plane ${this.icao} is landingg`);
                //Plane landing
                const nearestAirport = this.findNearestAirport();
                let flight = await Flight.findOne({
                    where: {plane_id: this.id, arrival_time: IsNull()},
                    order: {id: 'DESC'}
                });
                if (flight === undefined) {
                    flight = new Flight();
                    flight.plane_id = this.id;
                    flight.callsign = data.callsign;
                    flight.squawk = data.squawk;
                }
                flight.arrival_time = new Date();
                if (nearestAirport?.airport !== null) {
                    PlaneAlert.log.info(`Plane ${this.icao} is landing on ${nearestAirport?.airport.name}`);
                    flight.arrival_airport = nearestAirport?.airport.ident;
                } else {
                    PlaneAlert.log.info(`Plane ${this.icao} is landing`);
                }
                await flight.save();
                this.triggerEvent(PlaneEvents.PLANE_LAND, flight, {nearestAirport: nearestAirport?.airport});
            }
            this.on_ground = data.onGround;
            this.live_track = true;
            this.last_seen = new Date();
            history.save();
        }else {
            if (!this.on_ground) {
                const lostTime = new Date(this.last_seen.getTime());
                lostTime.setMinutes(lostTime.getMinutes() + PlaneAlert.config['landingSignalLostThreshold']);
                if (lostTime < new Date()) {
                    //lost landing
                    PlaneAlert.log.info(`Plane ${this.icao} is lost`);
                    if (this.last_altitude !== null && this.last_altitude < PlaneAlert.config['landingAltitudeThreshold']) {
                        const nearestAirport = this.findNearestAirport();
                        let flight = await Flight.findOne({
                            where: {plane_id: this.id, arrival_time: IsNull()},
                            order: {id: 'DESC'}
                        });
                        if (flight === undefined) {
                            flight = new Flight();
                            flight.plane_id = this.id;
                        }
                        flight.arrival_time = new Date();
                        if (nearestAirport?.airport !== null) {
                            PlaneAlert.log.info(`Plane ${this.icao} is landing on ${nearestAirport?.airport.name}`);
                            flight.arrival_airport = nearestAirport?.airport.ident;
                        }
                        this.on_ground = true;
                        await flight.save();
                        this.triggerEvent(PlaneEvents.PLANE_LAND, flight, {nearestAirport: nearestAirport?.airport});
                    }
                }
            }
            this.live_track = false;
        }
        this.last_refresh = new Date();
        this.next_refresh = new Date();
        this.next_refresh.setSeconds(this.next_refresh.getSeconds() + this.refresh_interval);
        this.save();
    }

    private async triggerEvent(event: PlaneEvents, flight: Flight, data: any = null) {
        PlaneAlert.log.info(`Plane ${this.name} (${this.icao}) triggered  ${event}`);
        let photoUrl = null;
        if (this.icao !== null) {
            const photoData = await axios.get('https://api.planespotters.net/pub/photos/hex/' + this.icao);
            if (photoData.status === 200 && photoData.data.photos.length > 0) {
                photoUrl = photoData.data.photos[0].thumbnail_large.src
            }
        }
        let adsbExchangeLink = 'https://globe.adsbexchange.com/?icao=' + this.icao;
        switch (event) {
            case PlaneEvents.PLANE_LAND:
                for (const discordAssignment of this.discordAccountAssignments) {
                    const hook = new Webhook(discordAssignment.discordAccount.webhook);
                    hook.setUsername(this.name);
                    if (photoUrl !== null) {
                        hook.setAvatar(photoUrl);
                    }
                    hook.send(`**${this.name}** (${this.registration}) landed on **${data.nearestAirport.name} (${flight.arrival_airport})** at ${flight.arrival_time.toLocaleString()}\n${adsbExchangeLink}`);
                }
                for (const twitterAssignment of this.twitterAccountAssignments) {
                    await twitterAssignment.twitterAccount.getClient().v2.tweet({
                        text: `${this.name} (#${this.registration}) landed on ${data.nearestAirport.name} (#${flight.arrival_airport}) at ${flight.arrival_time.toLocaleString()}\n${adsbExchangeLink}`,
                    })
                }
                break;
            case PlaneEvents.PLANE_TAKEOFF:
                for (const discordAssignment of this.discordAccountAssignments) {
                    const hook = new Webhook(discordAssignment.discordAccount.webhook);
                    hook.setUsername(this.name);
                    if (photoUrl !== null) {
                        hook.setAvatar(photoUrl);
                    }
                    hook.send(`**${this.name}** (${this.registration}) takeoff from **${data.nearestAirport.name} (${flight.departure_airport})** at ${flight.departure_time.toLocaleString()} as flight **${flight.callsign}**\n${adsbExchangeLink}`);
                }
                for (const twitterAssignment of this.twitterAccountAssignments) {
                    await twitterAssignment.twitterAccount.getClient().v2.tweet({
                        text: `${this.name} (#${this.registration}) takeoff from ${data.nearestAirport.name} (#${flight.departure_airport}) at ${flight.departure_time.toLocaleString()} as flight #${flight.callsign}\n${adsbExchangeLink}`,
                    })
                }
                break;
            default:
                break;
        }
    }

    private findNearestAirport() {
        if (this.last_lng === null || this.last_lat === null || PlaneAlert.airports === null) {
            return null;
        }
        PlaneAlert.log.debug(`Plane ${this.name} (${this.icao}) searching for nearest airport of ${this.last_lat / 1E6}/${this.last_lng / 1E6}`);
        let min_distance = Number.MAX_SAFE_INTEGER;
        let nearest_airport = null;
        const allowedAirportsArray = this.allowed_airports.split(",");
        for(const airport of PlaneAlert.airports) {
            if (airport.type === 'closed') {
                continue;
            }
            if (allowedAirportsArray.indexOf(airport.type) === -1) {
                continue;
            }
            const distance = GeoUtils.distanceBetweenCoordinates(this.last_lat / 1E6, this.last_lng / 1E6, airport.latitude_deg, airport.longitude_deg);
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

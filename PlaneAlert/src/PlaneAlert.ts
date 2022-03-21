import {Logger} from "tslog";
import {createConnection, LessThan} from "typeorm";
import {Plane} from "./entities/Plane";
import * as fs from "fs";
import {TrackSource} from "./enum/TrackSource";
import {OpenSkySource} from "./tracksources/open-sky/OpenSkySource";
import axios from "axios";
import {Flight} from "./entities/Flight";
import * as Sentry from '@sentry/node';
import {TwitterAccount} from "./entities/TwitterAccount";
import {DiscordWebhook} from "./entities/DiscordWebhook";
import {DiscordAssignment} from "./entities/DiscordAssignment";
import {TwitterAssignment} from "./entities/TwitterAssignment";
import {TrackHistory} from "./entities/TrackHistory";
import {VirtualRadarServerSource} from "./tracksources/virtual-radar-server/VirtualRadarServerSource";

class PlaneAlertMain {
    public log: Logger;
    public db: any;
    public config: any;
    public trackSource: OpenSkySource | any | undefined;
    public airports: any = [];
    public regions: any = [];
    public countries: any = [];
    public twitterAccounts: TwitterAccount[] = [];


    constructor() {
        this.log = new Logger();
        this.log.info("PlaneAlert started");
        this.config = this.loadConfig();
        if (this.config['sentryDSN'] !== '') {
            Sentry.init({
                dsn: this.config['sentryDSN'],
                tracesSampleRate: 1.0,
            });
            this.log.info("Sentry enabled");
        }
        const csvToJson = require('convert-csv-to-json');
        //check if file exists
        axios({
            url: 'https://davidmegginson.github.io/ourairports-data/airports.csv',
            method: 'GET',
        }).then((response) => {
            fs.writeFileSync('data/airports.csv', response.data.replace(/"/g, ''));
            fs.writeFileSync('data/airports.json', JSON.stringify(csvToJson.fieldDelimiter(',').getJsonFromCsv('data/airports.csv')));
            this.airports = JSON.parse(fs.readFileSync("data/airports.json", "utf8"));
            this.log.info("Airport Data Updated");
        });
        axios({
            url: 'https://davidmegginson.github.io/ourairports-data/regions.csv',
            method: 'GET',
        }).then((response) => {
            fs.writeFileSync('data/regions.csv', response.data.replace(/"/g, ''));
            fs.writeFileSync('data/regions.json', JSON.stringify(csvToJson.fieldDelimiter(',').getJsonFromCsv('data/regions.csv')));
            this.regions = JSON.parse(fs.readFileSync("data/regions.json", "utf8"));
            this.log.info("Regions Data Updated");
        });
        axios({
            url: 'https://davidmegginson.github.io/ourairports-data/countries.csv',
            method: 'GET',
        }).then((response) => {
            fs.writeFileSync('data/countries.csv', response.data.replace(/"/g, ''));
            fs.writeFileSync('data/countries.json', JSON.stringify(csvToJson.fieldDelimiter(',').getJsonFromCsv('data/countries.csv')));
            this.countries = JSON.parse(fs.readFileSync("data/countries.json", "utf8"));
            this.log.info("Countries Data Updated");
        });
        this.initDatabase().then(async () => {
            if (this.db.isConnected) {
                this.log.info("Database initialized");
                TwitterAccount.find().then(async (twitterAccounts) => {
                    for (const twitterAccount of twitterAccounts) {
                        this.twitterAccounts.push(twitterAccount);
                        this.log.info("loaded  Twitter Account: " + twitterAccount.username);
                        // twitterAccount.getClient().v2.tweet({
                        //     text: "Testing Twitter API",
                        // })
                    }
                });
                await this.updatePlaneData();
                //
            }
        });
        switch (this.config['trackSource']) {
            case TrackSource.OPEN_SKY_NETWORK:
                this.log.info("Track source: OpenSky Network");
                this.trackSource = new OpenSkySource();
                break;
            case TrackSource.FLIGHT_RADAR_24    :
                this.log.info("Track source: FlighRadar 24");
                const FlightRadar24Source = require('./tracksources/flight-radar-24/FlightRadar24Source');
                this.trackSource = new FlightRadar24Source.FlightRadar24Source();
                break;
            case TrackSource.VIRTUAL_RADAR_SERVER:
                this.log.info("Track source: Virtual Radar Server");
                this.trackSource = new VirtualRadarServerSource();
                break;
        }
    }

    async initDatabase() {
        try {
            this.db = await createConnection({
                type: "postgres",
                host: this.config['databaseHost'],
                port: 5432,
                username: this.config['databaseUsername'],
                password: this.config['databasePassword'],
                database: this.config['databaseName'],
                entities: [
                    Plane,
                    Flight,
                    TwitterAccount,
                    DiscordWebhook,
                    DiscordAssignment,
                    TwitterAssignment,
                    TrackHistory,
                ],
                logging: false,
                synchronize: true,
            });
        } catch (e) {
            this.log.fatal(e);
            this.log.fatal("Database connection failed")
        }
    }

    private loadConfig() {
        return JSON.parse(fs.readFileSync("./config.json", "utf8"));
    }

    private async updatePlaneData() {
        if (PlaneAlert.airports.length > 0) {
            const planes = await Plane.find({
                where: [
                    {
                        active: true,
                        next_refresh: LessThan(new Date()),
                    },
                    {
                        active: true,
                        next_refresh: null,
                    }
                ],
                relations: ["twitterAccountAssignments", "discordAccountAssignments"],
            });
            for (const plane of planes) {
                this.log.info("Updating plane: " + plane.icao);
                if (plane.icao === "" || plane.icao === null) {
                    this.log.warn("Plane " + plane.name + " has no ICAO");
                    if (this.config['aeroDataBoxAPIKey'] !== "") {
                        try {
                            let rx = await axios.get('https://aerodatabox.p.rapidapi.com/aircrafts/reg/' + plane.registration, {
                                headers: {
                                    "x-rapidapi-host": "aerodatabox.p.rapidapi.com",
                                    "x-rapidapi-key": this.config['aeroDataBoxAPIKey'],
                                }
                            });
                            if (rx.status === 200) {
                                plane.icao = rx.data.hexIcao;
                                this.log.info("Found ICAO: " + plane.icao + " for " + plane.name);
                                await plane.save();
                            }
                        } catch (e) {
                            plane.active = false;
                            await plane.save();
                        }

                    }
                    continue;
                }
                if (plane.registration === "" || plane.registration === null) {
                    this.log.warn("Plane " + plane.name + " has no registration");
                    if (this.config['aeroDataBoxAPIKey'] !== "") {
                        try {
                            let rx = await axios.get('https://aerodatabox.p.rapidapi.com/aircrafts/icao24/' + plane.icao, {
                                headers: {
                                    "x-rapidapi-host": "aerodatabox.p.rapidapi.com",
                                    "x-rapidapi-key": this.config['aeroDataBoxAPIKey'],
                                }
                            });
                            if (rx.status === 200) {
                                plane.registration = rx.data.reg;
                                this.log.info("Found REG: " + plane.registration + " for " + plane.name);
                                await plane.save();
                            }
                        } catch (e) {
                            plane.active = false;
                            await plane.save();
                        }

                    }
                    continue;
                }
                await plane.update();
            }
        }
        setTimeout(() => {
            this.updatePlaneData();
        }, 1000);
    }
}

export const PlaneAlert = new PlaneAlertMain();

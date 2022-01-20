import {Logger} from "tslog";
import {createConnection, LessThan} from "typeorm";
import {Plane} from "./entities/Plane";
import * as fs from "fs";
import {TrackSource} from "./enum/TrackSource";
import {OpenSkySource} from "./tracksources/OpenSkySource";
import axios from "axios";
import {Flight} from "./entities/Flight";


class PlaneAlertMain {
    public log: Logger;
    public db: any;
    public config: any;
    public trackSource: OpenSkySource | undefined;
    public airports: any = [];
    public regions: any = [];
    public countries: any = [];


    constructor() {
        this.log = new Logger();
        this.log.info("PlaneAlert started");
        this.config = this.loadConfig();
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
                await this.updatePlaneData();
                //
            }
        });
        switch (this.config['trackSource']) {
            case TrackSource.OPEN_SKY_NETWORK:
                this.log.info("Track source: OpenSky Network");
                this.trackSource = new OpenSkySource();
        }
    }

    async initDatabase() {
        try {
            this.db = await createConnection({
                type: "postgres",
                host: "localhost",
                port: 5432,
                username: "postgres",
                password: "123456789",
                database: "planealert",
                entities: [
                    Plane,
                    Flight,
                ],
                logging: false,
                synchronize: true,
            });
        } catch (e) {
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
                ]
            });
            for (const plane of planes) {
                this.log.info("Updating plane: " + plane.icao);
                await plane.update();
            }
        }
        setTimeout(() => {
            this.updatePlaneData();
        }, 1000);
    }
}

export const PlaneAlert = new PlaneAlertMain();

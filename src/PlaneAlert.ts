import {Logger} from "tslog";
import {createConnection, LessThan} from "typeorm";
import {Plane} from "./entities/Plane";
import * as fs from "fs";
import {TrackSource} from "./enum/TrackSource";
import {OpenSkySource} from "./tracksources/OpenSkySource";
import axios from "axios";



class PlaneAlertMain {
    public log: Logger;
    public db: any;
    public config: any;
    public trackSource: OpenSkySource | undefined;


    constructor() {
        this.log = new Logger();
        this.log.info("PlaneAlert started");
        this.config = this.loadConfig();
        //check if file exists
        if (!fs.existsSync('data/airports.csv')) {
            this.log.info("airports.csv not found, downloading...");
            axios({
                url: 'https://davidmegginson.github.io/ourairports-data/airports.csv',
                method: 'GET',
            }).then((response) => {
                fs.writeFileSync('data/airports.csv', response.data);
                this.log.info("airports.csv downloaded");
            });

        }
        if (!fs.existsSync('data/regions.csv')) {
            this.log.info("regions.csv not found, downloading...");
            axios({
                url: 'https://davidmegginson.github.io/ourairports-data/regions.csv',
                method: 'GET',
            }).then((response) => {
                fs.writeFileSync('data/regions.csv', response.data);
                this.log.info("regions.csv downloaded");
            });

        }
        if (!fs.existsSync('data/countries.csv')) {
            this.log.info("countries.csv not found, downloading...");
            axios({
                url: 'https://davidmegginson.github.io/ourairports-data/countries.csv',
                method: 'GET',
            }).then((response) => {
                fs.writeFileSync('data/countries.csv', response.data);
                this.log.info("countries.csv downloaded");
            });

        }
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
                    Plane
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
        setTimeout(() => {
            this.updatePlaneData();
        }, 1000);
    }
}

export const PlaneAlert = new PlaneAlertMain();

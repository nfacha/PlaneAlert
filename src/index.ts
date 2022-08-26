import {Logger} from "tslog";
import * as fs from "fs";
import {TrackSource} from "./enum/TrackSource";
import {OpenSkySource} from "./tracksources/open-sky/OpenSkySource";
import axios from "axios";
import * as Sentry from '@sentry/node';
import {VirtualRadarServerSource} from "./tracksources/virtual-radar-server/VirtualRadarServerSource";
import {FachaDevSource} from "./tracksources/facha-dev/FachaDevSource";
import {Aircraft} from "./models/Aircraft";
import YAML from "yaml";
import {Airline} from "./models/Airline";
import {Type} from "./models/Type";

class Index {
    public log: Logger;
    public db: any;
    public config: any;
    public trackSource: OpenSkySource | any | undefined;
    public airports: any = [];
    public regions: any = [];
    public countries: any = [];
    public aircraft: any = [] //TODO
    public airlines: Airline[] = [];
    public types: Type[] = [];


    constructor() {
        this.log = new Logger({minLevel: 'debug'});
        this.log.info("PlaneAlert starting");
        process.on('exit', this.exitHandler.bind(this));
        process.on('SIGINT', this.exitHandler.bind(this));
        process.on('SIGUSR1', this.exitHandler.bind(this));
        process.on('SIGUSR2', this.exitHandler.bind(this));
        this.config = this.loadConfig();
        this.log.setSettings({minLevel: this.config.log.level});
        this.log.info("Log level set to " + this.config.log.level);
        if (this.config.telemetry.sentry.dsn !== null) {
            Sentry.init({
                dsn: this.config.telemetry.sentry.dsn,
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
        switch (this.config.tracksource.primary) {
            case TrackSource.OPEN_SKY_NETWORK:
                this.log.info("Track source: OpenSky Network");
                this.trackSource = new OpenSkySource();
                break;
            case TrackSource.VIRTUAL_RADAR_SERVER:
                this.log.info("Track source: Virtual Radar Server");
                this.trackSource = new VirtualRadarServerSource();
                break;
            case TrackSource.FACHADEV:
                this.log.info("Track source: Facha.Dev");
                this.trackSource = new FachaDevSource();
                break;
        }
        this.loadAircraft();
        this.loadAirlines()
        this.loadTypes();
        setInterval(() => {
            for (const aircraft of this.aircraft) {
                aircraft.check();
            }
            for (const airline of this.airlines) {
                airline.check();
            }
            for (const type of this.types) {
                type.check();
            }
        }, 1000 * this.config.refreshInterval);
    }

    private loadConfig() {
        return YAML.parse(fs.readFileSync("./config/main.yaml", "utf8"));
    }

    private loadAircraft() {
        this.log.info("Loading Aircraft");
        const files = fs.readdirSync('./config/aircraft');
        setTimeout(() => {
            for (const i in files) {
                let file = files[i];
                if (file.endsWith('.yaml')) {
                    this.log.info("Loading Aircraft: " + file);
                    let aircraft = new Aircraft(fs.readFileSync('./config/aircraft/' + file, 'utf8'), file);
                    this.aircraft.push(aircraft);

                }
            }
        }, 500);
    }

    private loadAirlines() {
        this.log.info("Loading Airlines");
        const files = fs.readdirSync('./config/airlines');
        setTimeout(() => {
            for (const i in files) {
                let file = files[i];
                if (file.endsWith('.yaml')) {
                    this.log.info("Loading Airlines: " + file);
                    let airline = new Airline(fs.readFileSync('./config/airlines/' + file, 'utf8'), file);
                    this.airlines.push(airline);
                }
            }
        }, 500);
    }

    private loadTypes() {
        this.log.info("Loading Types");
        const files = fs.readdirSync('./config/types');
        setTimeout(() => {
            for (const i in files) {
                let file = files[i];
                if (file.endsWith('.yaml')) {
                    this.log.info("Loading Type: " + file);
                    let type = new Type(fs.readFileSync('./config/types/' + file, 'utf8'), file);
                    this.types.push(type);
                }
            }
        }, 500);
    }

    private exitHandler() {
        PlaneAlert.log.info("Cleaning up before exit");
        for (const aircraft of this.aircraft) {
            aircraft.save();
        }
        for (const airline of this.airlines) {
            airline.save();
        }
    }
}

export const PlaneAlert = new Index();

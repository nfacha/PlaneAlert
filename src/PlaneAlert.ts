import {Logger} from "tslog";
import {createConnection} from "typeorm";
import {Plane} from "./entities/Plane";
import * as fs from "fs";
import {TrackSource} from "./enum/TrackSource";
import {OpenSkySource} from "./tracksources/OpenSkySource";

class PlaneAlertMain{
    public log: Logger;
    public db: any;
    public config: any;
    public trackSource: OpenSkySource|undefined;


    constructor() {
        this.log = new Logger();
        this.log.info("PlaneAlert started");
        this.config = this.loadConfig();
        this.initDatabase().then(async () => {
            if(this.db.isConnected){
                this.log.info("Database initialized");
                this.updatePlaneData();
                //
            }
        });
        switch (this.config['trackSource']){
            case TrackSource.OPEN_SKY_NETWORK:
                this.log.info("Track source: OpenSky Network");
                this.trackSource = new OpenSkySource();
        }
    }

    async initDatabase() {
        try{
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
        }catch (e){
            this.log.fatal("Database connection failed")
        }
    }

    private loadConfig() {
        return JSON.parse(fs.readFileSync("./config.json", "utf8"));
    }

    private async updatePlaneData(){
        const planes = await Plane.find({where: {active: true}});
        for(const plane of planes){
            this.log.info("Updating plane: " + plane.icao);
            plane.update();
        }
    }
}
export const PlaneAlert = new PlaneAlertMain();

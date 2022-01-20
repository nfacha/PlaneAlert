import {Logger} from "tslog";
import {createConnection} from "typeorm";

class PlaneAlertMain{
    public log: Logger;
    public db: any;


    constructor() {
        this.log = new Logger();
        this.log.info("PlaneAlert started");
        this.initDatabase().then(async () => {
            if(this.db.isConnected){
                this.log.info("Database initialized");
                //
            }
        });
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
                entities: [],
                logging: true,
                synchronize: true,
            });
        }catch (e){
            this.log.fatal("Database connection failed")
        }
    }
}
export const PlaneAlert = new PlaneAlertMain();

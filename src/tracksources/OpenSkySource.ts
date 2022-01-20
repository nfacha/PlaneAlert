import axios from "axios";
import {PlaneAlert} from "../PlaneAlert";

export class OpenSkySource{
    private BASE = 'https://opensky-network.org/api/';

    public async getPlaneStatus(icao24: string){
        const rx = await axios.get(`${this.BASE}states/all?icao24=${icao24}`)
        PlaneAlert.log.debug(rx)
    }
}

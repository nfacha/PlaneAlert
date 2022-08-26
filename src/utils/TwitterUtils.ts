import {TwitterApi} from "twitter-api-v2";
import {PlaneAlert} from "../index";

export default class TwitterUtils {
    public static getTwitterClient(token:string, secret:string){
        if (PlaneAlert.config.twitter.appToken === null || PlaneAlert.config.twitter.appSecret === null) {
            return null;
        }
        return new TwitterApi(
            {
                appKey: PlaneAlert.config.twitter.appToken,
                appSecret: PlaneAlert.config.twitter.appSecret,
                accessToken: token,
                accessSecret: secret
            });
    }
}

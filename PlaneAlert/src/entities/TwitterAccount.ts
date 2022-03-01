import {BaseEntity, Column, Entity, PrimaryGeneratedColumn} from "typeorm";
import {TwitterApi} from "twitter-api-v2";
import {PlaneAlert} from "../PlaneAlert";

@Entity()
export class TwitterAccount extends BaseEntity {

    @PrimaryGeneratedColumn()
    id!: number;
    @Column({type: "varchar"})
    username!: string;
    @Column({type: "varchar", length: 255})
    user_id!: string;
    @Column({type: "varchar", length: 255})
    access_token!: string;
    @Column({type: "varchar", length: 255})
    access_secret!: string;

    public getClient() {
        return new TwitterApi(
            {
                appKey: PlaneAlert.config['twitterAppToken'],
                appSecret: PlaneAlert.config['twitterAppSecret'],
                accessToken: this.access_token,
                accessSecret: this.access_secret
            });
    }
}

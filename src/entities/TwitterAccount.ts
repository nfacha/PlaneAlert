import {BaseEntity, Column, Entity, OneToMany, PrimaryGeneratedColumn} from "typeorm";
import {TwitterApi} from "twitter-api-v2";
import {PlaneAlert} from "../index";
import {TwitterAssignment} from "./TwitterAssignment";

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

    @OneToMany(() => TwitterAssignment, account => account.twitterAccount)
    assignments!: TwitterAssignment[];

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

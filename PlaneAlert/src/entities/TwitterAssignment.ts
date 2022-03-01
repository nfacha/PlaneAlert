import {BaseEntity, Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn} from "typeorm";
import {Plane} from "./Plane";
import {TwitterAccount} from "./TwitterAccount";

@Entity()
export class TwitterAssignment extends BaseEntity {

    @PrimaryGeneratedColumn()
    id!: number;
    @Column({type: "integer"})
    plane_id!: number;
    @Column({type: "integer"})
    twitter_account_id!: number;
    // @JoinColumn({name: 'plane_id'})
    // plane!: Plane;
    @JoinColumn({name: 'twitter_account_id'})
    twitterAccount!: TwitterAccount;
    @ManyToOne(() => Plane, plane => plane.twitterAccountAssignments)
    @JoinColumn({name: "plane_id"})
    plane!: Plane;
}

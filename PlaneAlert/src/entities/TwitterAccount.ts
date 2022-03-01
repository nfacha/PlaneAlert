import {BaseEntity, Column, Entity, PrimaryGeneratedColumn} from "typeorm";

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
}

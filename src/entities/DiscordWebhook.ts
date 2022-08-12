import {BaseEntity, Column, Entity, OneToMany, PrimaryGeneratedColumn} from "typeorm";
import {DiscordAssignment} from "./DiscordAssignment";

@Entity()
export class DiscordWebhook extends BaseEntity {

    @PrimaryGeneratedColumn()
    id!: number;
    @Column({type: "varchar"})
    name!: string;
    @Column({type: "text", nullable: true})
    webhook!: string;

    @OneToMany(() => DiscordAssignment, account => account.discordAccount)
    assignments!: DiscordAssignment[];


}

import {BaseEntity, Column, Entity, PrimaryGeneratedColumn} from "typeorm";

@Entity()
export class DiscordWebhook extends BaseEntity {

    @PrimaryGeneratedColumn()
    id!: number;
    @Column({type: "varchar"})
    name!: string;
    @Column({type: "text", nullable: true})
    webhook!: string;

}

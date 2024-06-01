import mongoose from "mongoose";

const Schema = mongoose.Schema;
const activitySchema = new Schema(
    {
        to: [{
            type: String,
            enum: ["investor", "prowner", "admin"],
        }],
        type: [{
            type: String,
            enum: ["investment", "project", "newUser"],
        }],
        title: {
            type: String,
            default: "",
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "user",
        },
        direct: [{
            type: Schema.Types.ObjectId,
            ref: "user",
        }],
        content: {
            type: String,
            default: "",
        },
        isRead: [{
            type: Schema.Types.ObjectId,
            ref: "user",
        }]
    },
    { timestamps: true }
);

const Activity = mongoose.model("activity", activitySchema);
export default Activity;

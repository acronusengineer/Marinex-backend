import Joi from "joi";


export const getActivitiesSchema = Joi.object({
    type: Joi.number().optional().description("Type of activities"),
});

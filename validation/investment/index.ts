import Joi from "joi";

export const investSchema = Joi.object({
  projectId: Joi.string().required().messages({
    "any.required": "Please provide projectId.",
  }),
  amount: Joi.number().required().min(1).messages({
    "any.required": "Please provide amount.",
    "number.base": "Provide valid number",
    "number.min": "Invest amount must be at least 1",
  }),
});

export const getInvestmentSchema = Joi.object({
  status: Joi.boolean().optional().description("Status of project"),
  page: Joi.number().optional().description("Page number for pagination"),
});

export const getStatisticsSchema = Joi.object({
  type: Joi.number().optional().description("Type of statistics"),
});

export const getInvestorGraph = Joi.object({
  period: Joi.string().optional().description("Graph of project"),
});


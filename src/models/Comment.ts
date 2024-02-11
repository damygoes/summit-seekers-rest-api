import mongoose, { Schema } from "mongoose";

const CommentSchema = new Schema(
  {
    activityId: {
      type: Schema.Types.ObjectId,
      ref: "Activity",
      required: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    parentId: Number,
    text: { type: String, required: true },
    replies: [
      {
        type: Schema.Types.ObjectId,
        ref: "Comment",
      },
    ],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    toJSON: {
      virtuals: true, // Ensure virtuals are included in JSON output
      versionKey: false, // Do not include the __v field
      transform: (doc, ret) => {
        delete ret._id; // Exclude _id from JSON output
      },
    },
  }
);

const CommentModel = mongoose.model("Comment", CommentSchema);

export { CommentModel };

import { Request, Response } from "express";
import slugify from "slugify";

import { CustomRequest } from "../../interfaces/customRequest";
import { ActivityModel } from "../../models/Activity";
import { BucketListModel } from "../../models/BucketList";
import { DoneActivityModel } from "../../models/DoneActivity";
import { LikeModel } from "../../models/Like";
import { UserModel } from "../../models/User";
import { activityValidationSchema } from "../../validations/activityValidator";

const getAllDoneActivities = async () => {
  try {
    const activities = await DoneActivityModel.find();
    return activities;
  } catch (error) {
    return { error: error.message };
  }
};

const getAllLikedActivities = async () => {
  try {
    const activities = await LikeModel.find();
    return activities;
  } catch (error) {
    return { error: error.message };
  }
};

const getAllBucketListActivities = async () => {
  try {
    const activities = await BucketListModel.find();
    return activities;
  } catch (error) {
    return { error: error.message };
  }
};
export const getActivities = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const {
    city,
    state,
    country,
    category,
    done = false,
    liked = false,
    bucketList = false,
  } = req.query as {
    city?: string;
    state?: string;
    country?: string;
    category?: string;
    done?: boolean;
    liked?: boolean;
    bucketList?: boolean;
  };

  if (done) {
    const doneActivities = await getAllDoneActivities();
    if (!doneActivities) {
      return res.status(404).json({ message: "Done activities not found" });
    }
    return res.json(doneActivities);
  }

  if (liked) {
    const likedActivities = await getAllLikedActivities();
    if (!likedActivities) {
      return res.status(404).json({ message: "Liked activities not found" });
    }
    return res.json(likedActivities);
  }

  if (bucketList) {
    const bucketListActivities = await getAllBucketListActivities();
    if (!bucketListActivities) {
      return res
        .status(404)
        .json({ message: "Bucket list activities not found" });
    }
    return res.json(bucketListActivities);
  }

  // Initialize query object
  let query: any = {};

  // Add query parameters if they exist
  if (city) query["address.city"] = city;
  if (state) query["address.state"] = state;
  if (country) query["address.country"] = country;
  if (category) query["climbCategory"] = category;

  // These are fields to exclude in the response. "Projection" is used to achieve this in MongoDB. This is optional but useful for performance.
  const projection = {
    description: 0,
    minimumGrade: 0,
    maximumGrade: 0,
    difficultyLevel: 0,
    routeType: 0,
    tags: 0,
    createdAt: 0,
    updatedAt: 0,
    startCoordinate: 0,
    endCoordinate: 0,
    createdBy: 0,
    isCreatedByAdmin: 0,
  };

  try {
    const activities = await ActivityModel.find(query, projection);
    return res.json(activities);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const getActivity = async (
  req: Request,
  res: Response
): Promise<Response<any, Record<string, any>>> => {
  const { slug } = req.params;

  try {
    const activity = await ActivityModel.findOne({ slug });

    if (!activity) {
      return res.status(404).json({ message: "Activity not found" });
    }

    return res.json(activity);
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid activity slug format" });
    }
    res.status(500).json({ error: error.message });
  }
};

export const getUsersCreatedActivities = async (
  req: CustomRequest,
  res: Response
): Promise<Response<any, Record<string, any>>> => {
  const userId = req.user?._id; // Assuming req.user is populated from session

  if (!userId) {
    return res.status(403).json({ message: "Authentication required" });
  }

  try {
    const activities = await ActivityModel.find({ createdBy: userId });
    res.json(activities);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// export const getUsersCreatedActivities = async (
//   req: CustomRequest,
//   res: Response
// ): Promise<void> => {
//   const userSessionId = req.user?._id.toString();

//   if (!userSessionId) {
//     res.status(403).json({ message: "User ID not found in token" });
//     return;
//   }

//   // Retrieve user role along with the user ID from the token
//   const user = await UserModel.findById(userSessionId);
//   if (!user) {
//     res.status(404).json({ message: "User not found" });
//     return;
//   }
//   const isUserAdmin = user.role === "ADMIN";

//   let query = {};

//   // If the user is not an admin, modify the query to fetch only their activities
//   if (!isUserAdmin) {
//     query = { createdBy: userSessionId };
//   }

//   try {
//     const activities = await ActivityModel.find(query);
//     res.json(activities);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

export const createActivity = async (req: CustomRequest, res: Response) => {
  const userId = req.user?._id.toString();

  // Validate request body first
  const validationResult = activityValidationSchema.validate(req.body);
  if (validationResult.error) {
    return res.status(400).json({ error: validationResult.error.message });
  }

  try {
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const isUserAdmin = user.role === "ADMIN";

    // Prepare slug to check for duplicates
    const slug = slugify(validationResult.value.name, {
      lower: true,
      strict: true,
    });

    // Check if an activity with the same slug already exists
    const existingActivity = await ActivityModel.findOne({ slug });
    if (existingActivity) {
      return res.status(409).json({ error: "Activity already exists" });
    }

    // Prepare data for creating the activity
    const activityData = {
      ...validationResult.value,
      slug,
      createdBy: userId,
      isCreatedByAdmin: isUserAdmin,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const newActivity = await ActivityModel.create(activityData);

    res.status(201).json(newActivity);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateActivity = async (
  req: CustomRequest,
  res: Response
): Promise<Response<any, Record<string, any>>> => {
  const { slug } = req.params;
  const userSessionId = req.user?._id.toString();

  try {
    // Retrieve user role along with the user ID from the token
    const user = await UserModel.findById(userSessionId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const isUserAdmin = user.role === "ADMIN";

    // Find activity by slug to check authorization before updating
    const activity = await ActivityModel.findOne({ slug: slug });
    if (!activity) {
      return res.status(404).json({ message: "Activity not found" });
    }

    // Check if the user is the creator or an admin
    if (!isUserAdmin && activity.createdBy.toString() !== userSessionId) {
      return res
        .status(403)
        .json({ message: "You are not authorized to update this activity" });
    }

    // Validate the incoming request body
    const validationResult = activityValidationSchema.validate(req.body);
    if (validationResult.error) {
      return res.status(400).json({ message: validationResult.error.message });
    }

    // Directly update the activity with validated data, including embedded address or coordinates if present
    const updateData = {
      ...validationResult.value,
      updatedAt: new Date(), // Ensure updatedAt is properly set
    };

    // If the name has changed, update the slug as well
    if (
      validationResult.value.name &&
      validationResult.value.name !== activity.name
    ) {
      updateData.slug = slugify(validationResult.value.name, {
        lower: true,
        strict: true,
      });
    }

    const updatedActivity = await ActivityModel.findOneAndUpdate(
      { slug: slug },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedActivity) {
      return res.status(404).json({ message: "Unable to update the activity" });
    }

    res.status(200).json(updatedActivity);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

//TODO: expand later to delete all related bucket list, done activities, comments and likes related to the activity
export const deleteActivity = async (
  req: CustomRequest,
  res: Response
): Promise<Response<any, Record<string, any>>> => {
  const { slug } = req.params;
  const userSessionId = req.user?._id.toString();

  try {
    // Retrieve user role along with the user ID from the token
    const user = await UserModel.findById(userSessionId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const isUserAdmin = user && user.role === "ADMIN";

    // Find activity by slug to authorize the deletion
    const activity = await ActivityModel.findOne({ slug: slug });
    if (!activity) {
      return res.status(404).json({ message: "Activity not found" });
    }

    // Check if the user is the creator or an admin
    if (!isUserAdmin && activity.createdBy.toString() !== userSessionId) {
      return res
        .status(403)
        .json({ message: "You are not authorized to delete this activity" });
    }

    // Proceed to delete the activity
    const deletedActivity = await ActivityModel.deleteOne({ slug: slug });
    if (deletedActivity.deletedCount === 0) {
      // No document found or deleted
      return res.status(404).json({ message: "Activity not found" });
    }

    res.status(204).send(); // 204 No Content for successful deletion
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getUsersBucketListActivities = async (
  req: CustomRequest,
  res: Response
): Promise<Response<any, Record<string, any>>> => {
  const userSessionId = req.user?._id.toString();

  if (!userSessionId) {
    res.status(403).json({ message: "Unauthorized" });
    return;
  }

  // Retrieve user role along with the user ID from the token
  const user = await UserModel.findById(userSessionId);
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }
  const isUserAdmin = user.role === "ADMIN";

  let query = {};

  // If the user is not an admin, modify the query to fetch only their activities
  if (!isUserAdmin) {
    query = { userId: userSessionId };
  }

  try {
    // Find bucket list items for the user
    const bucketListItems = await BucketListModel.find(query).lean(); // Using lean() for performance, as we're not modifying the bucket list items here
    if (bucketListItems.length === 0) {
      return res
        .status(404)
        .json({ message: "No bucket list items found for the user" });
    }

    // Extract activityIds from the bucket list items
    const activityIds = bucketListItems.map((item) => item.activityId);

    // Find and populate the activities in a single query
    const activities = await ActivityModel.find({ _id: { $in: activityIds } })
      .populate("address")
      .populate("startCoordinate")
      .populate("endCoordinate")
      .lean(); // Using lean() for performance, as we're not modifying the activities here

    // Return the populated activities
    res.json(activities);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getUsersLikedActivities = async (
  req: CustomRequest,
  res: Response
): Promise<Response<any, Record<string, any>>> => {
  const userSessionId = req.user?._id.toString();

  if (!userSessionId) {
    res.status(403).json({ message: "User ID not found in token" });
    return;
  }

  // Retrieve user role along with the user ID from the token
  const user = await UserModel.findById(userSessionId);
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }
  const isUserAdmin = user.role === "ADMIN";

  let query = {};

  // If the user is not an admin, modify the query to fetch only their activities
  if (!isUserAdmin) {
    query = { userId: userSessionId };
  }

  try {
    // Find liked activities for the user
    const likedActivities = await LikeModel.find(query).lean(); // Using lean() for performance, as we're not modifying the liked activities here

    if (likedActivities.length === 0) {
      return res
        .status(404)
        .json({ message: "No liked activities found for the user" });
    }

    // Extract activityIds from the liked activities
    const activityIds = likedActivities.map((item) => item.activityId);

    // Find and populate the activities in a single query
    const activities = await ActivityModel.find({ _id: { $in: activityIds } })
      .populate("address")
      .populate("startCoordinate")
      .populate("endCoordinate")
      .lean(); // Using lean() for performance, as we're not modifying the activities here

    // Return the populated activities
    res.json(activities);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getUsersDoneActivities = async (
  req: CustomRequest,
  res: Response
): Promise<Response<any, Record<string, any>>> => {
  const userSessionId = req.user?._id.toString();

  if (!userSessionId) {
    res.status(403).json({ message: "User ID not found in token" });
    return;
  }

  // Retrieve user role along with the user ID from the token
  const user = await UserModel.findById(userSessionId);
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }
  const isUserAdmin = user.role === "ADMIN";

  let query = {};

  // If the user is not an admin, modify the query to fetch only their activities
  if (!isUserAdmin) {
    query = { userId: userSessionId };
  }

  try {
    const doneActivities = await DoneActivityModel.find(query).lean();

    if (doneActivities.length === 0) {
      return res
        .status(404)
        .json({ message: "No done activities found for the user" });
    }

    const activityIds = doneActivities.map((item) => item.activityId);

    const activities = await ActivityModel.find({ _id: { $in: activityIds } })
      .populate("address")
      .populate("startCoordinate")
      .populate("endCoordinate")
      .lean();

    res.json(activities);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const handleUserActionOnActivity = async (
  req: CustomRequest,
  res: Response
): Promise<Response<any, Record<string, any>>> => {
  const { slug } = req.params;
  const userSessionId = req.user?._id.toString();
  const { addToBucketList, alreadyCompleted, like } = req.query as {
    addToBucketList?: boolean;
    alreadyCompleted?: boolean;
    like?: boolean;
  };

  try {
    const user = await UserModel.findById(userSessionId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Find activity by slug to authorize the deletion
    const activity = await ActivityModel.findOne({ slug: slug });
    if (!activity) {
      return res.status(404).json({ message: "Activity not found" });
    }

    if (activity && addToBucketList) {
      // Add activity to user's bucket list
      const bucketListItem = await BucketListModel.findOne({
        activityId: activity._id,
        userId: userSessionId,
      });

      if (bucketListItem) {
        return res
          .status(409)
          .json({ message: "Activity already exists in user's bucket list" });
      }

      const newBucketListItem = await BucketListModel.create({
        activityId: activity._id,
        userId: userSessionId,
        addedAt: new Date(),
      });

      return res.status(201).json(newBucketListItem);
    }

    if (activity && alreadyCompleted) {
      // Add activity to user's done activities
      const doneActivity = await DoneActivityModel.findOne({
        activityId: activity._id,
        userId: userSessionId,
      });

      if (doneActivity) {
        return res.status(409).json({
          message: "Activity already exists in user's done activities",
        });
      }

      const newDoneActivity = await DoneActivityModel.create({
        activityId: activity._id,
        userId: userSessionId,
        completedAt: new Date(),
      });

      return res.status(201).json(newDoneActivity);
    }

    if (activity && like) {
      // Add user to the likes array
      const likedActivity = await LikeModel.findOne({
        activityId: activity._id,
        userId: userSessionId,
      });

      if (likedActivity) {
        return res
          .status(409)
          .json({ message: "User already liked the activity" });
      }

      const newLike = await LikeModel.create({
        activityId: activity._id,
        userId: userSessionId,
        likedAt: new Date(),
      });

      return res.status(201).json(newLike);
    }

    // res.status(200).json(updatedActivity);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getActivityLikes = async (
  req: Request,
  res: Response
): Promise<Response<any, Record<string, any>>> => {
  const { slug } = req.params;

  try {
    const activity = await ActivityModel.findOne({ slug });
    if (!activity) {
      return res.status(404).json({ message: "Activity not found" });
    }

    const likes = await LikeModel.find({ activityId: activity._id });

    res.json(likes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteUserBucketListActivity = async (
  req: CustomRequest,
  res: Response
): Promise<Response<any, Record<string, any>>> => {
  const { slug } = req.params;
  const userSessionId = req.user?._id.toString();

  try {
    // Retrieve user role along with the user ID from the token
    const user = await UserModel.findById(userSessionId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const isUserAdmin = user && user.role === "ADMIN";

    // Find activity by slug to authorize the deletion
    const activity = await ActivityModel.findOne({ slug: slug });
    if (!activity) {
      return res.status(404).json({ message: "Activity not found" });
    }

    // Check if the user has the activity in their bucket list
    const bucketListItem = await BucketListModel.findOne({
      activityId: activity._id,
      userId: userSessionId,
    });

    if (!bucketListItem) {
      return res
        .status(404)
        .json({ message: "Activity not found in user's bucket list" });
    }

    // Proceed to delete the activity from the user's bucket list
    const deletedBucketListItem = await BucketListModel.deleteOne({
      activityId: activity._id,
      userId: userSessionId,
    });
    if (deletedBucketListItem.deletedCount === 0) {
      // No document found or deleted
      return res
        .status(404)
        .json({ message: "Activity not found in bucket list" });
    }

    res.status(204).send(); // 204 No Content for successful deletion
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteUserDoneActivity = async (
  req: CustomRequest,
  res: Response
): Promise<Response<any, Record<string, any>>> => {
  const { slug } = req.params;
  const userSessionId = req.user?._id.toString();

  try {
    // Retrieve user role along with the user ID from the token
    const user = await UserModel.findById(userSessionId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Find activity by slug to authorize the deletion
    const activity = await ActivityModel.findOne({ slug: slug });
    if (!activity) {
      return res.status(404).json({ message: "Activity not found" });
    }

    // Check if the user has the activity in their done activities
    const doneActivity = await DoneActivityModel.findOne({
      activityId: activity._id,
      userId: userSessionId,
    });

    if (!doneActivity) {
      return res
        .status(404)
        .json({ message: "Activity not found in user's done activities" });
    }

    // Proceed to delete the activity from the user's done activities
    const deletedDoneActivity = await DoneActivityModel.deleteOne({
      activityId: activity._id,
      userId: userSessionId,
    });
    if (deletedDoneActivity.deletedCount === 0) {
      // No document found or deleted
      return res
        .status(404)
        .json({ message: "Activity not found in done activities" });
    }

    res.status(204).send(); // 204 No Content for successful deletion
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteUserLikedActivity = async (
  req: CustomRequest,
  res: Response
): Promise<Response<any, Record<string, any>>> => {
  const { slug } = req.params;
  const userSessionId = req.user?._id.toString();

  try {
    // Retrieve user role along with the user ID from the token
    const user = await UserModel.findById(userSessionId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Find activity by slug to authorize the deletion
    const activity = await ActivityModel.findOne({ slug: slug });
    if (!activity) {
      return res.status(404).json({ message: "Activity not found" });
    }

    // Check if the user has liked the activity
    const likedActivity = await LikeModel.findOne({
      activityId: activity._id,
      userId: userSessionId,
    });

    if (!likedActivity) {
      return res
        .status(404)
        .json({ message: "User has not liked the activity" });
    }

    // Proceed to delete the like
    const deletedLike = await LikeModel.deleteOne({
      activityId: activity._id,
      userId: userSessionId,
    });
    if (deletedLike.deletedCount === 0) {
      // No document found or deleted
      return res.status(404).json({ message: "Like not found" });
    }

    res.status(204).send(); // 204 No Content for successful deletion
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

//Database Seeding
// export const seedDatabaseWithMultipleActivities = async (
//   req: CustomRequest,
//   res: Response
// ) => {
//   const userId = req.user?._id.toString();
//   const activitiesData = req.body.activities; // Expecting an array of activities in the request body

//   try {
//     const user = await UserModel.findById(userId);
//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }
//     const isUserAdmin = user.role === "ADMIN";

//     // Validate and prepare all activities data before insertion
//     const preparedActivities = activitiesData.map(
//       (activityInput: Activity[]) => {
//         const validationResult =
//           activityValidationSchema.validate(activityInput);
//         if (validationResult.error) {
//           throw new Error(validationResult.error.message); // This will exit the loop and catch block will catch it
//         }

//         return {
//           ...validationResult.value,
//           slug: slugify(validationResult.value.name, {
//             lower: true,
//             strict: true,
//           }),
//           createdBy: userId,
//           isCreatedByAdmin: isUserAdmin,
//           createdAt: new Date(),
//           updatedAt: new Date(),
//         };
//       }
//     );

//     // Bulk insert the prepared activities
//     await ActivityModel.insertMany(preparedActivities);

//     res.status(201).json({
//       message: `${preparedActivities.length} activities created successfully.`,
//     });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

/**
 * EXPLANATION OF CODE on createActivity
 * 
 * In Mongoose, when you use Model.create([document], { session }) with an array of documents, even if it's just a single document in that array, the method returns an array of documents. This is consistent behavior with how Mongoose handles bulk creation, allowing you to create multiple documents in a single operation. Therefore, even though you're only creating one document, because you're passing it in an array, the return value is an array of created documents. To access the first (and in this case, only) document, you need to use array notation ([0]) to access the document and then get its _id.

In contrast, if you were to call Model.create(document, { session }) without wrapping the document in an array, the return value would be a single document object, and you could directly access its _id with address._id.

This is an important distinction to make because it affects how you access the returned document's properties. If you're consistently using the array notation for a single document creation due to using transactions or expecting to potentially expand to bulk operations in the future, you'll need to remember to access the document using the [0] index.
 */

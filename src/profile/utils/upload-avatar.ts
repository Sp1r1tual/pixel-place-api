import { cloudinary } from "../../shared/configs/cloudinary.js";
import { ApiError } from "../../shared/exceptions/api-error.js";

const uploadAvatarToCloudinary = (
  fileBuffer: Buffer,
  userId: string,
): Promise<string> =>
  new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "avatars",
        public_id: `avatar_${userId}_${Date.now()}`,
        transformation: [
          { width: 200, height: 200, crop: "fill", gravity: "face" },
          { quality: "auto" },
        ],
      },
      (error, result) => {
        if (error || !result) {
          console.error("Error uploading to Cloudinary:", error);
          reject(ApiError.BadRequest("profile.failed-to-update-profile"));
        } else {
          resolve(result.secure_url);
        }
      },
    );

    uploadStream.end(fileBuffer);
  });

export { uploadAvatarToCloudinary };

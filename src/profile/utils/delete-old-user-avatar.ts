import { v2 as cloudinary } from "cloudinary";

const deleteOldAvatarIfNeeded = async (
  oldAvatar: string,
  newAvatar: string,
) => {
  if (!oldAvatar || oldAvatar === newAvatar) return;
  if (!oldAvatar.includes("res.cloudinary.com")) return;

  const publicId = extractPublicId(oldAvatar);

  if (!publicId) return;

  await cloudinary.uploader.destroy(publicId);
};

const extractPublicId = (url: string) => {
  try {
    const cleanUrl = url.split("?")[0];
    const parts = cleanUrl.split("/upload/");

    if (parts.length < 2) return null;

    let pathAndFile = parts[1];

    pathAndFile = pathAndFile.replace(/^v\d+\//, "");

    const segments = pathAndFile.split(".");
    segments.pop();

    return segments.join(".");
  } catch {
    return null;
  }
};

export { deleteOldAvatarIfNeeded };

import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useGroupStore } from "../store/useGroupStore";
import { Camera } from "lucide-react";
import toast from "react-hot-toast";

const GroupProfileUpdate = () => {
  const [imagePreview, setImagePreview] = useState(null);
  const navigate = useNavigate();
  const { groupId } = useParams();
  const { selectedGroup, updateGroupProfile, isUpdatingGroupProfile } = useGroupStore();

  const compressImage = (base64Str) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        
        // Compress and convert to JPEG format
        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);
        resolve(compressedBase64);
      };
    });
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const compressedImage = await compressImage(reader.result);
        setImagePreview(compressedImage);
      } catch (error) {
        console.error("Error compressing image:", error);
        toast.error("Failed to process image");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!imagePreview) {
      toast.error("Please select an image");
      return;
    }

    try {
      await updateGroupProfile(groupId, { groupImage: imagePreview });
      toast.success("Group profile updated successfully");
      navigate(-1);
    } catch (error) {
      console.error("Failed to update group profile:", error);
      toast.error(error.response?.data?.message || "Failed to update group profile");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-base-200 p-4">
      <div className="bg-base-100 rounded-lg p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold text-center mb-6">Update Group Profile</h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <img
                src={imagePreview || selectedGroup?.groupImage || "/group-avatar.png"}
                alt="Group Profile"
                className="w-32 h-32 rounded-full object-cover border-4 border-base-300"
              />
              <label
                htmlFor="profile-image"
                className="absolute bottom-0 right-0 bg-primary hover:bg-primary-focus p-2 rounded-full cursor-pointer transition-all duration-200"
              >
                <Camera className="w-5 h-5 text-primary-content" />
                <input
                  type="file"
                  id="profile-image"
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageChange}
                />
              </label>
            </div>
            <p className="text-sm text-base-content/70">
              Click the camera icon to change group photo
            </p>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="btn btn-ghost"
              disabled={isUpdatingGroupProfile}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!imagePreview || isUpdatingGroupProfile}
            >
              {isUpdatingGroupProfile ? "Updating..." : "Update Profile"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GroupProfileUpdate;

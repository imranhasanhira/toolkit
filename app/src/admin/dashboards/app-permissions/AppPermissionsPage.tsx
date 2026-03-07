import { type AuthUser } from "wasp/auth";
import Breadcrumb from "../../layout/Breadcrumb";
import DefaultLayout from "../../layout/DefaultLayout";
import AppPermissionsMatrix from "./AppPermissionsMatrix";

const AppPermissionsPage = ({ user }: { user: AuthUser }) => {
  return (
    <DefaultLayout user={user}>
      <Breadcrumb pageName="App permissions" />
      <div className="flex flex-col gap-10">
        <AppPermissionsMatrix />
      </div>
    </DefaultLayout>
  );
};

export default AppPermissionsPage;
